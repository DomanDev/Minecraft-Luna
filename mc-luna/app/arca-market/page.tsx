"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";
import { toast } from "sonner";

type TradeTab = "sell" | "buy";
type TradeStatus = "open" | "completed" | "cancelled";
type SortKey = "recent" | "price_low" | "price_high";
type PlanType = "free" | "pro";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  plan_type: PlanType | null;
};

type ArcaTradePostRow = {
  id: string;
  user_id: string;
  post_type: TradeTab;
  ratio: number;
  arca_amount: number;
  cell_amount: number;
  title: string | null;
  note: string | null;
  contact_preference: "whisper" | "discord" | null;
  contact_value: string | null;
  is_featured: boolean;
  status: TradeStatus;
  created_at: string;
  completed_at: string | null;
  seller_display_name: string | null;
  seller_mc_nickname: string | null;
  trade_mode: "bulk" | "split";
  split_unit: number | null;
};

type MyOpenPostSummary = {
  hasOpenSell: boolean;
  hasOpenBuy: boolean;
};

const PAGE_SIZE = 15;
const FEATURED_LIMIT = 8;

const TAB_LABEL: Record<TradeTab, string> = {
  sell: "판매",
  buy: "구매",
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "최근등록순" },
  { value: "price_low", label: "낮은가격순" },
  { value: "price_high", label: "높은가격순" },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function getArcaCreatePostErrorMessage(message: string): string {
  if (message.includes("1시간")) {
    return "새 거래글 작성은 마지막 작성 후 1시간이 지나야 가능합니다.";
  }

  if (message.includes("열린 판매글은 계정당 1개만")) {
    return "현재 열린 판매글이 이미 있습니다. 판매글은 1개만 등록할 수 있습니다.";
  }

  if (message.includes("열린 구매글은 계정당 1개만")) {
    return "현재 열린 구매글이 이미 있습니다. 구매글은 1개만 등록할 수 있습니다.";
  }

  if (message.includes("로그인이 필요합니다")) {
    return "로그인 후 다시 시도해 주세요.";
  }

  if (message.includes("post_type은 buy 또는 sell")) {
    return "거래 종류 값이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
  }

  if (message.includes("비율은 0보다 커야")) {
    return "비율을 올바르게 입력해 주세요.";
  }

  if (message.includes("수량은 1 이상")) {
    return "수량을 올바르게 입력해 주세요.";
  }

  if (message.includes("trade_mode는 bulk 또는 split")) {
    return "거래 방식 값이 올바르지 않습니다.";
  }

  if (message.includes("분할 거래 단위는 1 이상")) {
    return "분할 거래 단위를 올바르게 입력해 주세요.";
  }

  if (message.includes("총 수량은 거래 단위의 배수")) {
    return "총 수량은 거래 단위의 배수여야 합니다.";
  }

  return "거래글 등록에 실패했습니다.";
}

function resetArcaTradeForm(
  setFormTitle: (value: string) => void,
  setFormNote: (value: string) => void,
  setFormRatio: (value: string) => void,
  setFormArcaAmount: (value: string) => void,
  setFormContactValue: (value: string) => void,
  setFormFeatured: (value: boolean) => void,
  setFormTradeMode: (value: "bulk" | "split") => void,
  setFormSplitUnit: (value: string) => void,
) {
  setFormTitle("");
  setFormNote("");
  setFormRatio("300");
  setFormArcaAmount("1000");
  setFormContactValue("");
  setFormFeatured(false);
  setFormTradeMode("bulk");
  setFormSplitUnit("10");
}

export default function ArcaMarketPage() {
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "아르카 거래 페이지를 사용하려면 로그인이 필요합니다.",
    profileMessage: "아르카 거래 페이지를 사용하려면 프로필 연동이 필요합니다.",
  });

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TradeTab>("sell");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  const [featuredPosts, setFeaturedPosts] = useState<ArcaTradePostRow[]>([]);
  const [listPosts, setListPosts] = useState<ArcaTradePostRow[]>([]);
  const [completedPosts, setCompletedPosts] = useState<ArcaTradePostRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailPost, setDetailPost] = useState<ArcaTradePostRow | null>(null);

  /**
   * 등록 폼 state
   *
   * 아이템매니아식으로 간단한 핵심 정보 위주:
   * - 탭(판매/구매)
   * - 비율
   * - 수량
   * - 제목/메모
   * - 연락 방식
   * - 광고 상품 여부 (Pro 전용)
   */
  const [formType, setFormType] = useState<TradeTab>("sell");
  const [formRatio, setFormRatio] = useState("300");
  const [formArcaAmount, setFormArcaAmount] = useState("1000");
  const [formTitle, setFormTitle] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formContactPreference, setFormContactPreference] = useState<
    "whisper" | "discord"
  >("whisper");
  const [formContactValue, setFormContactValue] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);
  
  const [formTradeMode, setFormTradeMode] = useState<"bulk" | "split">("bulk");
  const [formSplitUnit, setFormSplitUnit] = useState("10");

  const isProUser = profile?.plan_type === "pro";
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const displayName = useMemo(() => {
    return profile?.display_name?.trim() || profile?.username?.trim() || "익명";
  }, [profile]);

  const minecraftNickname = useMemo(() => {
    return profile?.username?.trim() || "";
  }, [profile]);

  const calculatedCellAmount = useMemo(() => {
    const ratio = Number(formRatio);
    const arcaAmount = Number(formArcaAmount);

    if (!Number.isFinite(ratio) || !Number.isFinite(arcaAmount)) return 0;
    if (ratio <= 0 || arcaAmount <= 0) return 0;

    return Math.round(ratio * arcaAmount);
  }, [formRatio, formArcaAmount]);

  const completedStats = useMemo(() => {
    if (completedPosts.length === 0) {
      return {
        tradeCount: 0,
        averageRatio: 0,
        totalArca: 0,
      };
    }

    const totalRatio = completedPosts.reduce((sum, post) => sum + post.ratio, 0);
    const totalArca = completedPosts.reduce((sum, post) => sum + post.arca_amount, 0);

    return {
      tradeCount: completedPosts.length,
      averageRatio: Math.round((totalRatio / completedPosts.length) * 100) / 100,
      totalArca,
    };
  }, [completedPosts]);

  const fetchSessionAndProfile = useCallback(async () => {
    if (guardLoading || !allowed) return;

    setProfileLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn("arca-market getSession 실패:", sessionError.message);
        setSessionUserId(null);
        setProfile(null);
        return;
      }

      const user = session?.user ?? null;
      setSessionUserId(user?.id ?? null);

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, plan_type")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("arca-market profiles 조회 실패:", error.message);
        setProfile(null);
        return;
      }

      setProfile(data as ProfileRow);
    } finally {
      setProfileLoading(false);
    }
  }, [allowed, guardLoading]);

  const fetchPosts = useCallback(async () => {
    if (guardLoading || !allowed) return;

    setLoadingPosts(true);

    try {
      /**
       * 1) 광고 상품
       * - 현재 탭 기준
       * - open 상태
       * - featured true
       * - 최근순
       */
      const { data: featuredData, error: featuredError } = await supabase
        .from("arca_trade_posts")
        .select("*")
        .eq("post_type", activeTab)
        .eq("status", "open")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(FEATURED_LIMIT);

      if (featuredError) {
        console.warn("광고 상품 조회 실패:", featuredError.message);
        setFeaturedPosts([]);
      } else {
        setFeaturedPosts((featuredData ?? []) as ArcaTradePostRow[]);
      }

      /**
       * 2) 일반 목록
       * - 광고 상품도 일반 목록에 다시 보여도 되지만
       *   화면 중복이 과하다고 느껴지면 is_featured=false만 따로 볼 수 있다.
       * - 여기서는 아이템매니아 느낌상 전체 open 목록을 그대로 보여준다.
       */
      let orderColumn: "created_at" | "ratio" = "created_at";
      let ascending = false;

      if (sortKey === "price_low") {
        orderColumn = "ratio";
        ascending = true;
      } else if (sortKey === "price_high") {
        orderColumn = "ratio";
        ascending = false;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const listQuery = supabase
        .from("arca_trade_posts")
        .select("*", { count: "exact" })
        .eq("post_type", activeTab)
        .eq("status", "open")
        .order(orderColumn, { ascending })
        .order("created_at", { ascending: false })
        .range(from, to);

      const { data: listData, error: listError, count } = await listQuery;

      if (listError) {
        console.warn("거래 목록 조회 실패:", listError.message);
        setListPosts([]);
        setTotalCount(0);
      } else {
        setListPosts((listData ?? []) as ArcaTradePostRow[]);
        setTotalCount(count ?? 0);
      }

      /**
       * 3) 최근 완료 거래 20개
       * - 간단 시세 통계용
       * - 메인 페이지로 옮길 때도 같은 쿼리 재사용 가능
       */
      const { data: completedData, error: completedError } = await supabase
        .from("arca_trade_posts")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);

      if (completedError) {
        console.warn("완료 거래 통계 조회 실패:", completedError.message);
        setCompletedPosts([]);
      } else {
        setCompletedPosts((completedData ?? []) as ArcaTradePostRow[]);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, [activeTab, allowed, guardLoading, page, sortKey]);

  const fetchMyOpenPostSummary = useCallback(async (): Promise<MyOpenPostSummary> => {
    if (!sessionUserId) {
      return { hasOpenSell: false, hasOpenBuy: false };
    }

    const { data, error } = await supabase
      .from("arca_trade_posts")
      .select("post_type")
      .eq("user_id", sessionUserId)
      .eq("status", "open");

    if (error) {
      console.warn("내 열린 거래글 조회 실패:", error.message);
      return { hasOpenSell: false, hasOpenBuy: false };
    }

    return {
      hasOpenSell: (data ?? []).some((row) => row.post_type === "sell"),
      hasOpenBuy: (data ?? []).some((row) => row.post_type === "buy"),
    };
  }, [sessionUserId]);

  useEffect(() => {
    void fetchSessionAndProfile();
  }, [fetchSessionAndProfile]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, sortKey]);

  const handleCreatePost = useCallback(async () => {
    if (!sessionUserId) {
      toast.error("로그인 정보가 없습니다.");
      return;
    }

    const openSummary = await fetchMyOpenPostSummary();

    if (formType === "sell" && openSummary.hasOpenSell) {
      toast.error("현재 열린 판매글이 이미 있습니다. 판매글은 1개만 등록할 수 있습니다.");
      return;
    }

    if (formType === "buy" && openSummary.hasOpenBuy) {
      toast.error("현재 열린 구매글이 이미 있습니다. 구매글은 1개만 등록할 수 있습니다.");
      return;
    }

    const ratio = Number(formRatio);
    const arcaAmount = Number(formArcaAmount);

    const splitUnit = formTradeMode === "split" ? Number(formSplitUnit) : null;

    if (!Number.isFinite(ratio) || ratio <= 0) {
      toast.error("비율을 올바르게 입력해 주세요.");
      return;
    }

    if (!Number.isFinite(arcaAmount) || arcaAmount <= 0) {
      toast.error("수량을 올바르게 입력해 주세요.");
      return;
    }

        if (formTradeMode === "split") {
      if (!Number.isFinite(splitUnit) || !splitUnit || splitUnit <= 0) {
        toast.error("분할 거래 단위를 올바르게 입력해 주세요.");
        return;
      }

      if (arcaAmount % splitUnit !== 0) {
        toast.error("총 수량은 거래 단위의 배수여야 합니다.");
        return;
      }
    }

    if (formContactPreference === "discord" && !formContactValue.trim()) {
      toast.error("디스코드 연락처를 입력해 주세요.");
      return;
    }

    if (formContactPreference === "whisper" && !minecraftNickname) {
      toast.error("귓말 거래를 사용하려면 프로필의 마인크래프트 닉네임이 필요합니다.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("create_arca_trade_post", {
        p_post_type: formType,
        p_ratio: ratio,
        p_arca_amount: arcaAmount,
        p_title: formTitle.trim() || null,
        p_note: formNote.trim() || null,
        p_contact_preference: formContactPreference,
        p_contact_value:
          formContactPreference === "discord" ? formContactValue.trim() || null : null,
        p_is_featured: isProUser ? formFeatured : false,
        p_seller_display_name: displayName,
        p_seller_mc_nickname: minecraftNickname || null,
        p_trade_mode: formTradeMode,
        p_split_unit: formTradeMode === "split" ? splitUnit : null,
      });

      if (error) {
        console.error("아르카 거래글 등록 실패:", error);

        const friendlyMessage = getArcaCreatePostErrorMessage(error.message || "");
        toast.error(friendlyMessage);
        return;
      }

      console.log("아르카 거래글 등록 성공:", data);
      toast.success("거래글을 등록했습니다.");

      resetArcaTradeForm(
        setFormTitle,
        setFormNote,
        setFormRatio,
        setFormArcaAmount,
        setFormContactValue,
        setFormFeatured,
        setFormTradeMode,
        setFormSplitUnit,
      );

      setActiveTab(formType);
      setPage(1);

      await fetchPosts();
    } finally {
      setSubmitting(false);
    }
  }, [
    displayName,
    fetchPosts,
    formArcaAmount,
    formContactPreference,
    formContactValue,
    formFeatured,
    formNote,
    formRatio,
    formTitle,
    formType,
    isProUser,
    minecraftNickname,
    sessionUserId,
    formSplitUnit,
    formTradeMode,
    fetchMyOpenPostSummary,
  ]);

  const handleUpdateStatus = useCallback(
    async (post: ArcaTradePostRow, nextStatus: TradeStatus) => {
      if (!sessionUserId) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      if (post.user_id !== sessionUserId) {
        toast.error("본인 글만 상태를 변경할 수 있습니다.");
        return;
      }

      const payload: Partial<ArcaTradePostRow> = {
        status: nextStatus,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("arca_trade_posts")
        .update(payload)
        .eq("id", post.id);

      if (error) {
        console.error("거래 상태 변경 실패:", error);
        toast.error("상태 변경에 실패했습니다.");
        return;
      }

      toast.success(
        nextStatus === "completed"
          ? "거래를 완료 처리했습니다."
          : "거래글을 취소 처리했습니다.",
      );

      setDetailPost(null);
      await fetchPosts();
    },
    [fetchPosts, sessionUserId],
  );

  const handleCopyWhisper = useCallback(async (post: ArcaTradePostRow) => {
    const targetNickname = post.seller_mc_nickname?.trim();

    if (!targetNickname) {
      toast.error("판매자의 마인크래프트 닉네임 정보가 없습니다.");
      return;
    }

    const template =
      post.post_type === "sell"
        ? `/w ${targetNickname} 안녕하세요. 아르카 판매글 보고 연락드렸습니다. 비율 ${post.ratio}:1 / 수량 ${formatNumber(post.arca_amount)} 거래 가능한가요?`
        : `/w ${targetNickname} 안녕하세요. 아르카 구매글 보고 연락드렸습니다. 비율 ${post.ratio}:1 / 수량 ${formatNumber(post.arca_amount)} 거래 가능한가요?`;

    try {
      await navigator.clipboard.writeText(template);
      toast.success("귓속말 문구를 복사했습니다.");
    } catch (error) {
      console.error("귓속말 문구 복사 실패:", error);
      toast.error("복사에 실패했습니다.");
    }
  }, []);

  if (guardLoading || !allowed || profileLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          아르카 거래소
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            아르카 거래소
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
            아르카 판매/구매 글을 등록하고, 귓속말과 디스코드 메시지 중심으로 빠르게 거래할 수 있는 거래 페이지
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs font-medium text-emerald-700">최근 완료 거래 수</div>
                <div className="mt-1 text-2xl font-bold text-emerald-900">
                    {formatNumber(completedStats.tradeCount)}건
                </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="text-xs font-medium text-sky-700">최근 평균 비율</div>
                <div className="mt-1 text-2xl font-bold text-sky-900">
                    {completedStats.tradeCount > 0 ? `${completedStats.averageRatio}:1` : "-"}
                </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-xs font-medium text-amber-700">최근 거래 총 아르카</div>
                <div className="mt-1 text-2xl font-bold text-amber-900">
                    {formatNumber(completedStats.totalArca)}
                </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">거래글 등록</h2>
          <p className="mt-1 text-sm text-zinc-500">
            판매/구매 글을 올리고, 필요하면 Pro 광고 상품으로 상단 노출할 수 있습니다.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-zinc-700">거래 종류</div>
              <div className="grid grid-cols-2 gap-2">
                {(["sell", "buy"] as TradeTab[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormType(type)}
                    className={classNames(
                      "rounded-xl border px-4 py-2 text-sm font-medium transition",
                      formType === type
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    {TAB_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                비율 (셀 : 아르카)
              </label>
              <input
                value={formRatio}
                onChange={(e) => setFormRatio(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="예: 300"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                수량 (아르카)
              </label>
              <input
                value={formArcaAmount}
                onChange={(e) => setFormArcaAmount(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="예: 1000"
              />
              <p className="mt-2 text-xs text-zinc-500">
                예상 총 셀: {formatNumber(calculatedCellAmount)}셀
              </p>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-zinc-700">거래 방식</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormTradeMode("bulk")}
                  className={classNames(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    formTradeMode === "bulk"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  일괄 거래
                </button>
                <button
                  type="button"
                  onClick={() => setFormTradeMode("split")}
                  className={classNames(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    formTradeMode === "split"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  분할 거래
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                일괄 거래는 전체 수량 한 번에 거래, 분할 거래는 거래 단위별 신청이 가능해.
              </p>
            </div>

            {formTradeMode === "split" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  거래 단위
                </label>
                <input
                  value={formSplitUnit}
                  onChange={(e) => setFormSplitUnit(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                  placeholder="예: 10"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  예: 총 1000 아르카 / 단위 10이면 10, 20, 30 ... 단위로 거래 가능
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                제목
              </label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="예: 대량 판매 / 빠른 거래 가능"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                메모
              </label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="거래 가능 시간, 우선 조건, 참고사항 등을 적어주세요."
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-zinc-700">연락 방식</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormContactPreference("whisper")}
                  className={classNames(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    formContactPreference === "whisper"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  귓말
                </button>
                <button
                  type="button"
                  onClick={() => setFormContactPreference("discord")}
                  className={classNames(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    formContactPreference === "discord"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  디스코드
                </button>
              </div>
            </div>

            {formContactPreference === "discord" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  디스코드 연락처
                </label>
                <input
                  value={formContactValue}
                  onChange={(e) => setFormContactValue(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                  placeholder="예: luna_user#1234 또는 디스코드 ID"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={formFeatured}
                disabled={!isProUser}
                onChange={(e) => setFormFeatured(e.target.checked)}
              />
              광고 상품으로 상단 노출
              {!isProUser && <span className="text-xs text-amber-600">(Pro 전용)</span>}
            </label>

            <button
              type="button"
              onClick={handleCreatePost}
              disabled={submitting}
              className={classNames( 
                "w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                ,submitting
                ? "cursor-not-allowed bg-zinc-400"
                : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {submitting ? "등록 중..." : "거래글 등록"}
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["sell", "buy"] as TradeTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={classNames(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      activeTab === tab
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    {TAB_LABEL[tab]} 탭
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">정렬</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-amber-900">광고 상품</h3>
                <p className="text-sm text-amber-700">
                  Pro 사용자가 올린 상단 노출 글입니다.
                </p>
              </div>
              <div className="text-xs text-amber-700">
                최대 {FEATURED_LIMIT}개 노출
              </div>
            </div>

            {featuredPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-white/60 px-4 py-6 text-sm text-zinc-500">
                현재 노출 중인 광고 상품이 없습니다.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featuredPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setDetailPost(post)}
                    className="rounded-2xl border border-amber-300 bg-white p-4 text-left transition hover:border-amber-500 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-bold text-white">
                        광고
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatDate(post.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 text-sm font-semibold text-zinc-900">
                      {post.title || `${TAB_LABEL[post.post_type]} 글`}
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                      <div>비율: {formatNumber(post.ratio)} : 1</div>
                      <div>수량: {formatNumber(post.arca_amount)} 아르카</div>
                      <div>
                        거래방식: {post.trade_mode === "bulk" ? "일괄" : `분할 (${formatNumber(post.split_unit ?? 0)}단위)`}
                      </div>
                      <div>등록자: {post.seller_display_name || "익명"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-base font-semibold text-zinc-900">
                {activeTab === "sell" ? "판매 상품 목록" : "구매 상품 목록"}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">구분</th>
                    <th className="px-4 py-3 text-left font-medium">거래방식</th>
                    <th className="px-4 py-3 text-left font-medium">비율</th>
                    <th className="px-4 py-3 text-left font-medium">수량</th>
                    <th className="px-4 py-3 text-left font-medium">총 셀</th>
                    <th className="px-4 py-3 text-left font-medium">작성자</th>
                    <th className="px-4 py-3 text-left font-medium">등록일</th>
                    <th className="px-4 py-3 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPosts ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                        목록을 불러오는 중...
                      </td>
                    </tr>
                  ) : listPosts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                        등록된 글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    listPosts.map((post) => (
                      <tr
                        key={post.id}
                        className="cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50"
                        onClick={() => setDetailPost(post)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={classNames(
                                "rounded-full px-2 py-1 text-xs font-semibold",
                                post.post_type === "sell"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-sky-100 text-sky-700",
                              )}
                            >
                              {TAB_LABEL[post.post_type]}
                            </span>
                            {post.is_featured && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                광고
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                            {post.trade_mode === "bulk"
                              ? "일괄"
                              : `분할 · 단위 ${formatNumber(post.split_unit ?? 0)}`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {formatNumber(post.ratio)} : 1
                        </td>
                        <td className="px-4 py-3">{formatNumber(post.arca_amount)}</td>
                        <td className="px-4 py-3">{formatNumber(post.cell_amount)}셀</td>
                        <td className="px-4 py-3">{post.seller_display_name || "익명"}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {formatDate(post.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            진행중
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
              <div className="text-sm text-zinc-500">
                총 {formatNumber(totalCount)}개 / {page}페이지
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이전
                </button>

                <span className="text-sm text-zinc-700">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-zinc-900">최근 거래 시세 통계</h3>
            <p className="mt-1 text-sm text-zinc-500">
              완료 처리된 최근 거래 20개를 기준으로 평균 비율을 간단히 보여줍니다.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                <div className="text-xs text-zinc-500">최근 완료 거래 수</div>
                <div className="mt-2 text-xl font-bold text-zinc-900">
                  {formatNumber(completedStats.tradeCount)}건
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                <div className="text-xs text-zinc-500">평균 거래 비율</div>
                <div className="mt-2 text-xl font-bold text-zinc-900">
                  {completedStats.tradeCount > 0
                    ? `${completedStats.averageRatio}:1`
                    : "-"}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                <div className="text-xs text-zinc-500">최근 누적 거래량</div>
                <div className="mt-2 text-xl font-bold text-zinc-900">
                  {formatNumber(completedStats.totalArca)} 아르카
                </div>
              </div>
            </div>

            {completedPosts.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">구분</th>
                      <th className="px-4 py-2 text-left font-medium">비율</th>
                      <th className="px-4 py-2 text-left font-medium">수량</th>
                      <th className="px-4 py-2 text-left font-medium">완료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedPosts.map((post) => (
                      <tr key={post.id} className="border-t border-zinc-100">
                        <td className="px-4 py-2">{TAB_LABEL[post.post_type]}</td>
                        <td className="px-4 py-2">{formatNumber(post.ratio)} : 1</td>
                        <td className="px-4 py-2">{formatNumber(post.arca_amount)}</td>
                        <td className="px-4 py-2 text-zinc-500">
                          {post.completed_at ? formatDate(post.completed_at) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </section>

      {detailPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      detailPost.post_type === "sell"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-sky-100 text-sky-700",
                    )}
                  >
                    {TAB_LABEL[detailPost.post_type]}
                  </span>
                  {detailPost.is_featured && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      광고
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-xl font-bold text-zinc-900">
                  {detailPost.title || `${TAB_LABEL[detailPost.post_type]} 거래글`}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setDetailPost(null)}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">비율</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.ratio)} : 1
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">수량</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.arca_amount)} 아르카
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">총 셀</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.cell_amount)}셀
                  </div>
                </div>
                                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">거래 방식</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {detailPost.trade_mode === "bulk"
                      ? "일괄 거래"
                      : `분할 거래 · 단위 ${formatNumber(detailPost.split_unit ?? 0)}`}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">등록일</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {formatDate(detailPost.created_at)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm font-semibold text-zinc-900">판매자 정보</div>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <div>표시명: {detailPost.seller_display_name || "익명"}</div>
                  <div>마크 닉네임: {detailPost.seller_mc_nickname || "-"}</div>
                  <div>
                    연락 방식:{" "}
                    {detailPost.contact_preference === "discord" ? "디스코드" : "귓말"}
                  </div>
                  {detailPost.contact_preference === "discord" && (
                    <div>디스코드: {detailPost.contact_value || "-"}</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm font-semibold text-zinc-900">메모</div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                  {detailPost.note?.trim() || "추가 메모 없음"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {detailPost.contact_preference === "whisper" ? (
                  <button
                    type="button"
                    onClick={() => void handleCopyWhisper(detailPost)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    귓말 문구 복사
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const value = detailPost.contact_value?.trim();
                      if (!value) {
                        toast.error("디스코드 연락처 정보가 없습니다.");
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(value);
                        toast.success("디스코드 연락처를 복사했습니다.");
                      } catch (error) {
                        console.error(error);
                        toast.error("복사에 실패했습니다.");
                      }
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    디스코드 연락처 복사
                  </button>
                )}

                {detailPost.user_id === sessionUserId && detailPost.status === "open" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(detailPost, "completed")}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                    >
                      거래 완료 처리
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateStatus(detailPost, "cancelled")}
                      className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      글 취소
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}