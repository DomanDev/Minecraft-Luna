"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";
import { toast } from "sonner";

type TradeTab = "sell" | "buy";
type TradeStatus = "open" | "completed" | "cancelled";
type SortKey = "recent" | "price_low" | "price_high";
type PlanType = "free" | "pro";
type ArcaViewTab = "sell" | "buy" | "my_posts" | "my_requests";

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
  reserved_quantity: number;
  completed_quantity: number;
};

type MyOpenPostSummary = {
  hasOpenSell: boolean;
  hasOpenBuy: boolean;
};

/**
 * arca_trade_requests_enriched view 기준 타입
 *
 * 중요:
 * - 기존 nested post 구조(req.post.xxx)가 아니라
 *   평평한(flat) 컬럼 구조를 사용한다.
 * - requester / owner 닉네임도 여기서 바로 내려온다.
 */
type ArcaTradeRequestEnrichedRow = {
  id: string;
  post_id: string;
  requester_id: string;
  owner_id: string;
  request_type: "buy_request" | "sell_request";
  request_quantity: number;
  ratio: number;
  total_cell_amount: number;
  status: "pending" | "cancelled" | "completed";
  created_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  requester_completed_at: string | null;
  owner_completed_at: string | null;

  requester_username: string | null;
  requester_display_name: string | null;
  owner_username: string | null;
  owner_display_name: string | null;

  post_ref_id: string | null;
  post_type: "sell" | "buy" | null;
  title: string | null;
  trade_mode: "bulk" | "split" | null;
  split_unit: number | null;
  arca_amount: number | null;
  post_status: "open" | "completed" | "cancelled" | null;
  post_user_id: string | null;
  seller_display_name: string | null;
  seller_mc_nickname: string | null;
};

const MARKET_PAGE_SIZE = 15;
const FEATURED_LIMIT = 8;

/**
 * 내 거래 신청 / 내가 등록한 거래
 * - 4건당 1페이지
 */
const MY_SECTION_PAGE_SIZE = 4;

/**
 * 내가 등록한 거래 > 각 글 내부의 신청 목록
 * - 너무 길어지지 않게 글당 3건씩만 보여주고 내부 페이지네이션
 */
const REQUESTS_PER_POST_PAGE = 3;

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

function getRemainingQuantity(post: ArcaTradePostRow): number {
  return Math.max(0, post.arca_amount - post.reserved_quantity - post.completed_quantity);
}

function getRequestStatusLabel(request: ArcaTradeRequestEnrichedRow): string {
  if (request.status === "completed") return "완료";
  if (request.status === "cancelled") return "취소";
  return "진행중";
}

function getCompletionProgressLabel(
  request: ArcaTradeRequestEnrichedRow,
  sessionUserId: string | null,
): string {
  const meDone =
    sessionUserId === request.requester_id
      ? request.requester_completed_at
      : sessionUserId === request.owner_id
        ? request.owner_completed_at
        : null;

  const otherDone =
    sessionUserId === request.requester_id
      ? request.owner_completed_at
      : sessionUserId === request.owner_id
        ? request.requester_completed_at
        : null;

  if (request.status === "completed") return "양측 완료";
  if (request.status === "cancelled") return "취소됨";

  if (meDone && otherDone) return "양측 완료";
  if (meDone) return "내 완료 확인";
  if (otherDone) return "상대 완료 확인";

  return "대기 중";
}

function getActionStatusText(
  request: ArcaTradeRequestEnrichedRow,
  sessionUserId: string | null,
): string {
  if (request.status === "completed") return "거래 완료";
  if (request.status === "cancelled") return "취소된 신청";

  const isRequester = sessionUserId === request.requester_id;
  const isOwner = sessionUserId === request.owner_id;

  const meDone = isRequester
    ? !!request.requester_completed_at
    : isOwner
      ? !!request.owner_completed_at
      : false;

  const otherDone = isRequester
    ? !!request.owner_completed_at
    : isOwner
      ? !!request.requester_completed_at
      : false;

  if (!meDone && !otherDone) return "거래 후 완료 버튼을 눌러 주세요.";
  if (meDone && !otherDone) return "상대방 완료 확인 대기 중입니다.";
  if (!meDone && otherDone) return "상대방이 먼저 완료 확인했습니다.";
  return "거래 진행 중입니다.";
}

function getActionStatusBadgeClass(
  request: ArcaTradeRequestEnrichedRow,
  sessionUserId: string | null,
): string {
  if (request.status === "completed") return "bg-emerald-100 text-emerald-700";
  if (request.status === "cancelled") return "bg-red-100 text-red-700";

  const isRequester = sessionUserId === request.requester_id;
  const isOwner = sessionUserId === request.owner_id;

  const meDone = isRequester
    ? !!request.requester_completed_at
    : isOwner
      ? !!request.owner_completed_at
      : false;

  const otherDone = isRequester
    ? !!request.owner_completed_at
    : isOwner
      ? !!request.requester_completed_at
      : false;

  if (meDone || otherDone) return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function getStepStatusText(request: ArcaTradeRequestEnrichedRow): string {
  if (request.status === "completed") return "양측 완료";
  if (request.status === "cancelled") return "취소됨";

  const requesterDone = !!request.requester_completed_at;
  const ownerDone = !!request.owner_completed_at;

  if (requesterDone || ownerDone) return "한쪽 완료 확인";
  return "거래 조율 중";
}

function getStepStatusBadgeClass(request: ArcaTradeRequestEnrichedRow): string {
  if (request.status === "completed") return "bg-emerald-100 text-emerald-700";
  if (request.status === "cancelled") return "bg-red-100 text-red-700";

  const requesterDone = !!request.requester_completed_at;
  const ownerDone = !!request.owner_completed_at;

  if (requesterDone || ownerDone) return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function getArcaCreateRequestErrorMessage(message: string): string {
  if (message.includes("로그인이 필요합니다")) return "로그인 후 다시 시도해 주세요.";
  if (message.includes("신청 수량은 1 이상")) return "신청 수량을 올바르게 입력해 주세요.";
  if (message.includes("거래글을 찾을 수 없습니다")) return "거래글 정보를 다시 불러온 뒤 시도해 주세요.";
  if (message.includes("진행 중인 거래글에만 신청")) return "현재 진행 중인 거래글에만 신청할 수 있습니다.";
  if (message.includes("본인 글에는 신청할 수 없습니다")) return "본인 글에는 신청할 수 없습니다.";
  if (message.includes("남은 수량보다 많이 신청")) return "남은 수량보다 많이 신청할 수 없습니다.";
  if (message.includes("일괄 거래는 전체 수량만 신청")) return "일괄 거래는 전체 수량만 신청할 수 있습니다.";
  if (message.includes("신청 수량은 거래 단위의 배수")) return "신청 수량은 거래 단위의 배수여야 합니다.";
  return "거래 신청에 실패했습니다.";
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
  if (message.includes("비율은 0보다 커야")) return "비율을 올바르게 입력해 주세요.";
  if (message.includes("수량은 1 이상")) return "수량을 올바르게 입력해 주세요.";
  if (message.includes("trade_mode는 bulk 또는 split")) return "거래 방식 값이 올바르지 않습니다.";
  if (message.includes("분할 거래 단위는 1 이상")) return "분할 거래 단위를 올바르게 입력해 주세요.";
  if (message.includes("총 수량은 거래 단위의 배수")) return "총 수량은 거래 단위의 배수여야 합니다.";
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
  setFormType: (value: TradeTab) => void,
) {
  setFormTitle("");
  setFormNote("");
  setFormRatio("300");
  setFormArcaAmount("1000");
  setFormContactValue("");
  setFormFeatured(false);
  setFormTradeMode("bulk");
  setFormSplitUnit("10");
  setFormType("sell");
}

function getRequestSummaryCounts(requests: ArcaTradeRequestEnrichedRow[]) {
  return requests.reduce(
    (acc, req) => {
      if (req.status === "completed") acc.completed += 1;
      else if (req.status === "cancelled") acc.cancelled += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, completed: 0, cancelled: 0 },
  );
}

function getSafeMcNickname(username: string | null, displayName: string | null): string {
  return username?.trim() || displayName?.trim() || "익명";
}

export default function ArcaMarketPage() {
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "아르카 거래 페이지를 사용하려면 로그인이 필요합니다.",
    profileMessage: "아르카 거래 페이지를 사용하려면 프로필 연동이 필요합니다.",
  });

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ArcaViewTab>("sell");

  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  /**
   * 우측 "내가 등록한 거래" / "내 거래 신청" 페이지네이션
   */
  const [myPostsPage, setMyPostsPage] = useState(1);
  const [myRequestsPage, setMyRequestsPage] = useState(1);

  /**
   * 각 게시글 내부 신청 목록 페이지네이션
   * key: post.id
   * value: 현재 페이지
   */
  const [postRequestPages, setPostRequestPages] = useState<Record<string, number>>({});

  const [featuredPosts, setFeaturedPosts] = useState<ArcaTradePostRow[]>([]);
  const [listPosts, setListPosts] = useState<ArcaTradePostRow[]>([]);
  const [completedPosts, setCompletedPosts] = useState<ArcaTradePostRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailPost, setDetailPost] = useState<ArcaTradePostRow | null>(null);
  const [detailRequest, setDetailRequest] = useState<ArcaTradeRequestEnrichedRow | null>(null);

  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const [myRequests, setMyRequests] = useState<ArcaTradeRequestEnrichedRow[]>([]);
  const [myPosts, setMyPosts] = useState<ArcaTradePostRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [receivedRequests, setReceivedRequests] = useState<ArcaTradeRequestEnrichedRow[]>([]);

  /**
   * 등록 폼 state
   * - 현재 탭과 무관하게 판매/구매 직접 선택
   */
  const [formRatio, setFormRatio] = useState("300");
  const [formArcaAmount, setFormArcaAmount] = useState("1000");
  const [formTitle, setFormTitle] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formContactPreference, setFormContactPreference] = useState<"whisper" | "discord">(
    "whisper",
  );
  const [formContactValue, setFormContactValue] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formTradeMode, setFormTradeMode] = useState<"bulk" | "split">("bulk");
  const [formSplitUnit, setFormSplitUnit] = useState("10");
  const [formType, setFormType] = useState<TradeTab>("sell");

  const isProUser = profile?.plan_type === "pro";
  const totalPages = Math.max(1, Math.ceil(totalCount / MARKET_PAGE_SIZE));

  const sellerNameForPost = useMemo(() => {
    return profile?.username?.trim() || profile?.display_name?.trim() || "익명";
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
      return { tradeCount: 0, averageRatio: 0, totalArca: 0 };
    }

    const totalRatio = completedPosts.reduce((sum, post) => sum + post.ratio, 0);
    const totalArca = completedPosts.reduce((sum, post) => sum + post.arca_amount, 0);

    return {
      tradeCount: completedPosts.length,
      averageRatio: Math.round((totalRatio / completedPosts.length) * 100) / 100,
      totalArca,
    };
  }, [completedPosts]);

  const receivedRequestsByPostId = useMemo(() => {
    return receivedRequests.reduce<Record<string, ArcaTradeRequestEnrichedRow[]>>((acc, req) => {
      const key = req.post_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(req);
      return acc;
    }, {});
  }, [receivedRequests]);

  /**
   * "내 거래 신청" 4건 단위 페이지네이션 결과
   */
  const pagedMyRequests = useMemo(() => {
    const from = (myRequestsPage - 1) * MY_SECTION_PAGE_SIZE;
    return myRequests.slice(from, from + MY_SECTION_PAGE_SIZE);
  }, [myRequests, myRequestsPage]);

  const myRequestsTotalPages = Math.max(1, Math.ceil(myRequests.length / MY_SECTION_PAGE_SIZE));

  /**
   * "내가 등록한 거래" 4건 단위 페이지네이션 결과
   */
  const pagedMyPosts = useMemo(() => {
    const from = (myPostsPage - 1) * MY_SECTION_PAGE_SIZE;
    return myPosts.slice(from, from + MY_SECTION_PAGE_SIZE);
  }, [myPosts, myPostsPage]);

  const myPostsTotalPages = Math.max(1, Math.ceil(myPosts.length / MY_SECTION_PAGE_SIZE));

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
    if (viewTab !== "sell" && viewTab !== "buy") return;

    setLoadingPosts(true);

    try {
      const { data: featuredData, error: featuredError } = await supabase
        .from("arca_trade_posts")
        .select("*")
        .eq("post_type", viewTab)
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

      let orderColumn: "created_at" | "ratio" = "created_at";
      let ascending = false;

      if (sortKey === "price_low") {
        orderColumn = "ratio";
        ascending = true;
      } else if (sortKey === "price_high") {
        orderColumn = "ratio";
        ascending = false;
      }

      const from = (page - 1) * MARKET_PAGE_SIZE;
      const to = from + MARKET_PAGE_SIZE - 1;

      const { data: listData, error: listError, count } = await supabase
        .from("arca_trade_posts")
        .select("*", { count: "exact" })
        .eq("post_type", viewTab)
        .eq("status", "open")
        .order(orderColumn, { ascending })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (listError) {
        console.warn("거래 목록 조회 실패:", listError.message);
        setListPosts([]);
        setTotalCount(0);
      } else {
        setListPosts((listData ?? []) as ArcaTradePostRow[]);
        setTotalCount(count ?? 0);
      }

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
  }, [allowed, guardLoading, page, sortKey, viewTab]);

  const fetchMyPosts = useCallback(async () => {
    if (!sessionUserId) return;

    /**
     * 요구사항:
     * - 완료된 거래도 유지
     * - 최신순 전체 가져오기
     */
    const { data, error } = await supabase
      .from("arca_trade_posts")
      .select("*")
      .eq("user_id", sessionUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("내 거래글 조회 실패:", error);
      return;
    }

    setMyPosts((data ?? []) as ArcaTradePostRow[]);
  }, [sessionUserId]);

  const fetchMyRequests = useCallback(async () => {
    if (!sessionUserId) return;

    setLoadingRequests(true);

    try {
      const { data, error } = await supabase
        .from("arca_trade_requests_enriched")
        .select("*")
        .eq("requester_id", sessionUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("신청 목록 조회 실패:", error);
        return;
      }

      setMyRequests((data ?? []) as ArcaTradeRequestEnrichedRow[]);
    } finally {
      setLoadingRequests(false);
    }
  }, [sessionUserId]);

  const fetchReceivedRequests = useCallback(async () => {
    if (!sessionUserId) return;

    const { data, error } = await supabase
      .from("arca_trade_requests_enriched")
      .select("*")
      .eq("owner_id", sessionUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("받은 신청 목록 조회 실패:", error);
      return;
    }

    setReceivedRequests((data ?? []) as ArcaTradeRequestEnrichedRow[]);
  }, [sessionUserId]);

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
    if (viewTab === "sell" || viewTab === "buy") {
      void fetchPosts();
    }
  }, [fetchPosts, viewTab]);

  useEffect(() => {
    void fetchMyRequests();
  }, [fetchMyRequests]);

  useEffect(() => {
    void fetchMyPosts();
  }, [fetchMyPosts]);

  useEffect(() => {
    void fetchReceivedRequests();
  }, [fetchReceivedRequests]);

  useEffect(() => {
    setPage(1);
  }, [viewTab, sortKey]);

  useEffect(() => {
    setMyPostsPage(1);
  }, [myPosts.length]);

  useEffect(() => {
    setMyRequestsPage(1);
  }, [myRequests.length]);

  useEffect(() => {
    if (!detailPost) return;

    if (detailPost.trade_mode === "bulk") {
      setRequestQuantity(String(detailPost.arca_amount));
      return;
    }

    setRequestQuantity(String(detailPost.split_unit ?? 1));
  }, [detailPost]);

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
      const { error } = await supabase.rpc("create_arca_trade_post", {
        p_post_type: formType,
        p_ratio: ratio,
        p_arca_amount: arcaAmount,
        p_title: formTitle.trim() || null,
        p_note: formNote.trim() || null,
        p_contact_preference: formContactPreference,
        p_contact_value:
          formContactPreference === "discord" ? formContactValue.trim() || null : null,
        p_is_featured: isProUser ? formFeatured : false,
        p_seller_display_name: sellerNameForPost,
        p_seller_mc_nickname: minecraftNickname || null,
        p_trade_mode: formTradeMode,
        p_split_unit: formTradeMode === "split" ? splitUnit : null,
      });

      if (error) {
        console.error("아르카 거래글 등록 실패:", error);
        toast.error(getArcaCreatePostErrorMessage(error.message || ""));
        return;
      }

      toast.success(
        formType === "sell"
          ? "판매글을 등록했습니다. 내 거래 목록에서 확인할 수 있습니다."
          : "구매글을 등록했습니다. 내 거래 목록에서 확인할 수 있습니다.",
      );

      resetArcaTradeForm(
        setFormTitle,
        setFormNote,
        setFormRatio,
        setFormArcaAmount,
        setFormContactValue,
        setFormFeatured,
        setFormTradeMode,
        setFormSplitUnit,
        setFormType,
      );

      setPage(1);

      await fetchPosts();
      await fetchMyPosts();
      await fetchMyRequests();
      await fetchReceivedRequests();
    } finally {
      setSubmitting(false);
    }
  }, [
    sellerNameForPost,
    fetchMyOpenPostSummary,
    fetchMyPosts,
    fetchMyRequests,
    fetchPosts,
    fetchReceivedRequests,
    formArcaAmount,
    formContactPreference,
    formContactValue,
    formFeatured,
    formNote,
    formRatio,
    formSplitUnit,
    formTradeMode,
    formType,
    formTitle,
    isProUser,
    minecraftNickname,
    sessionUserId,
  ]);

  const handleCreateTradeRequest = useCallback(
    async (post: ArcaTradePostRow) => {
      if (!sessionUserId) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      if (post.user_id === sessionUserId) {
        toast.error("본인 글에는 신청할 수 없습니다.");
        return;
      }

      const quantity = post.trade_mode === "bulk" ? post.arca_amount : Number(requestQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error("신청 수량을 올바르게 입력해 주세요.");
        return;
      }

      const remainingQuantity = getRemainingQuantity(post);

      if (quantity > remainingQuantity) {
        toast.error("남은 수량보다 많이 신청할 수 없습니다.");
        return;
      }

      if (post.trade_mode === "split") {
        const unit = post.split_unit ?? 0;

        if (unit <= 0) {
          toast.error("분할 거래 단위 정보가 올바르지 않습니다.");
          return;
        }

        if (quantity % unit !== 0) {
          toast.error("신청 수량은 거래 단위의 배수여야 합니다.");
          return;
        }
      }

      setRequestSubmitting(true);

      try {
        const { error } = await supabase.rpc("create_arca_trade_request", {
          p_post_id: post.id,
          p_request_quantity: quantity,
        });

        if (error) {
          console.error("거래 신청 실패:", error);
          toast.error(getArcaCreateRequestErrorMessage(error.message || ""));
          return;
        }

        toast.success(
          post.post_type === "sell"
            ? "구매 신청을 보냈습니다. 내 거래 신청 탭에서 진행 상태를 확인해 주세요."
            : "판매 신청을 보냈습니다. 내 거래 신청 탭에서 진행 상태를 확인해 주세요.",
        );

        setDetailPost(null);
        await fetchPosts();
        await fetchMyRequests();
        await fetchReceivedRequests();
        await fetchMyPosts();
      } finally {
        setRequestSubmitting(false);
      }
    },
    [fetchMyPosts, fetchMyRequests, fetchPosts, fetchReceivedRequests, requestQuantity, sessionUserId],
  );

  const handleCancelRequest = useCallback(
    async (request: ArcaTradeRequestEnrichedRow) => {
      setRequestSubmitting(true);

      try {
        const { error } = await supabase.rpc("cancel_arca_trade_request", {
          p_request_id: request.id,
        });

        if (error) {
          console.error("신청 취소 실패:", error);
          toast.error("신청 취소에 실패했습니다.");
          return;
        }

        toast.success("신청을 취소했습니다. 관련 수량이 즉시 복구되었습니다.");

        await fetchMyRequests();
        await fetchPosts();
        await fetchReceivedRequests();
        await fetchMyPosts();

        setDetailRequest((prev) => (prev?.id === request.id ? null : prev));
      } finally {
        setRequestSubmitting(false);
      }
    },
    [fetchMyPosts, fetchMyRequests, fetchPosts, fetchReceivedRequests],
  );

  const handleCompleteRequest = useCallback(
    async (request: ArcaTradeRequestEnrichedRow) => {
      setRequestSubmitting(true);

      try {
        const otherSideAlreadyDone =
          sessionUserId === request.requester_id
            ? !!request.owner_completed_at
            : sessionUserId === request.owner_id
              ? !!request.requester_completed_at
              : false;

        const { error } = await supabase.rpc("complete_arca_trade_request", {
          p_request_id: request.id,
        });

        if (error) {
          console.error("거래 완료 처리 실패:", error);
          const message = error.message || "";

          if (message.includes("진행 중인 신청만 완료")) {
            toast.error("진행 중인 신청만 완료 처리할 수 있습니다.");
          } else if (message.includes("거래 당사자만 완료")) {
            toast.error("거래 당사자만 완료 처리할 수 있습니다.");
          } else {
            toast.error("거래 완료 처리에 실패했습니다.");
          }
          return;
        }

        if (otherSideAlreadyDone) {
          toast.success("양측 완료가 확인되어 거래가 최종 완료되었습니다.");
        } else {
          toast.success("내 완료 확인이 반영되었습니다. 상대방 확인을 기다려 주세요.");
        }

        await fetchMyRequests();
        await fetchReceivedRequests();
        await fetchPosts();
        await fetchMyPosts();
      } finally {
        setRequestSubmitting(false);
      }
    },
    [fetchMyPosts, fetchMyRequests, fetchPosts, fetchReceivedRequests, sessionUserId],
  );

  const handleCancelPost = useCallback(
    async (post: ArcaTradePostRow) => {
      if (!sessionUserId) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      if (post.user_id !== sessionUserId) {
        toast.error("본인 글만 상태를 변경할 수 있습니다.");
        return;
      }

      const { error } = await supabase.rpc("cancel_arca_trade_post", {
        p_post_id: post.id,
      });

      if (error) {
        console.error("거래글 취소 실패:", error);

        const message = error.message || "";
        if (message.includes("진행 중인 신청이 있는 글은 취소")) {
          toast.error("진행 중인 신청이 있는 글은 취소할 수 없습니다.");
        } else if (message.includes("진행 중인 글만 취소")) {
          toast.error("진행 중인 글만 취소할 수 있습니다.");
        } else {
          toast.error("글 취소에 실패했습니다.");
        }
        return;
      }

      toast.success("거래글을 취소했습니다.");

      setDetailPost(null);
      await fetchPosts();
      await fetchMyRequests();
      await fetchReceivedRequests();
      await fetchMyPosts();
    },
    [fetchMyPosts, fetchMyRequests, fetchPosts, fetchReceivedRequests, sessionUserId],
  );

  /**
   * 요청 삭제
   * - 완료/취소된 내역만 정리 가능
   * - 실제 delete는 RLS 정책 필요
   */
  const handleDeleteRequest = useCallback(
    async (request: ArcaTradeRequestEnrichedRow) => {
      if (!sessionUserId) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      if (request.requester_id !== sessionUserId && request.owner_id !== sessionUserId) {
        toast.error("삭제 권한이 없습니다.");
        return;
      }

      if (request.status === "pending") {
        toast.error("진행 중 신청은 삭제할 수 없습니다. 먼저 취소 또는 완료 상태여야 합니다.");
        return;
      }

      const confirmed = window.confirm("이 신청 내역을 목록에서 삭제할까요?");
      if (!confirmed) return;

      const { error } = await supabase.from("arca_trade_requests").delete().eq("id", request.id);

      if (error) {
        console.error("신청 내역 삭제 실패:", error);
        toast.error("신청 내역 삭제에 실패했습니다. RLS 정책도 함께 확인해 주세요.");
        return;
      }

      toast.success("신청 내역을 삭제했습니다.");

      if (detailRequest?.id === request.id) {
        setDetailRequest(null);
      }

      await fetchMyRequests();
      await fetchReceivedRequests();
      await fetchMyPosts();
      await fetchPosts();
    },
    [detailRequest?.id, fetchMyPosts, fetchMyRequests, fetchPosts, fetchReceivedRequests, sessionUserId],
  );

  /**
   * 게시글 삭제
   * - 진행 중 글은 삭제 불가
   * - 취소/완료 글만 정리용 삭제 허용
   */
  const handleDeletePost = useCallback(
    async (post: ArcaTradePostRow) => {
      if (!sessionUserId) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      if (post.user_id !== sessionUserId) {
        toast.error("본인 글만 삭제할 수 있습니다.");
        return;
      }

      if (post.status === "open") {
        toast.error("진행 중 글은 삭제할 수 없습니다. 먼저 취소 상태 또는 완료 상태여야 합니다.");
        return;
      }

      const confirmed = window.confirm("이 거래글을 내 목록에서 삭제할까요?");
      if (!confirmed) return;

      const { error } = await supabase.from("arca_trade_posts").delete().eq("id", post.id);

      if (error) {
        console.error("거래글 삭제 실패:", error);
        toast.error("거래글 삭제에 실패했습니다. RLS 정책도 함께 확인해 주세요.");
        return;
      }

      toast.success("거래글을 삭제했습니다.");

      if (detailPost?.id === post.id) {
        setDetailPost(null);
      }

      await fetchMyPosts();
      await fetchReceivedRequests();
      await fetchPosts();
    },
    [detailPost?.id, fetchMyPosts, fetchPosts, fetchReceivedRequests, sessionUserId],
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

  const getRequesterName = useCallback((req: ArcaTradeRequestEnrichedRow): string => {
    return getSafeMcNickname(req.requester_username, req.requester_display_name);
  }, []);

  const getOwnerName = useCallback((req: ArcaTradeRequestEnrichedRow): string => {
    return getSafeMcNickname(req.owner_username, req.owner_display_name);
  }, []);

  const getCounterpartyName = useCallback(
    (req: ArcaTradeRequestEnrichedRow): string => {
      const requesterName = getSafeMcNickname(req.requester_username, req.requester_display_name);
      const ownerName = getSafeMcNickname(req.owner_username, req.owner_display_name);
      return sessionUserId === req.requester_id ? ownerName : requesterName;
    },
    [sessionUserId],
  );

  const getPagedRequestsForPost = useCallback(
    (postId: string, requests: ArcaTradeRequestEnrichedRow[]) => {
      const currentPage = postRequestPages[postId] ?? 1;
      const totalPages = Math.max(1, Math.ceil(requests.length / REQUESTS_PER_POST_PAGE));
      const safePage = Math.min(currentPage, totalPages);
      const from = (safePage - 1) * REQUESTS_PER_POST_PAGE;
      const paged = requests.slice(from, from + REQUESTS_PER_POST_PAGE);

      return {
        currentPage: safePage,
        totalPages,
        paged,
      };
    },
    [postRequestPages],
  );

  if (guardLoading || !allowed || profileLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">아르카 거래소</h1>
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
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">아르카 거래소</h1>
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
            판매/구매 글을 등록하고, Pro 광고 상품으로 상단 노출할 수 있습니다.
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
              <label className="mb-2 block text-sm font-medium text-zinc-700">수량 (아르카)</label>
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
                <label className="mb-2 block text-sm font-medium text-zinc-700">거래 단위</label>
                <input
                  value={formSplitUnit}
                  onChange={(e) => setFormSplitUnit(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                  placeholder="예: 10"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  예: 단위 10이면 10, 20, 30 단위로 거래 가능
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">제목</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="예: 대량 판매 / 빠른 거래 가능"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">메모</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                placeholder="거래 가능 시간, 참고사항 등을 적어주세요."
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
                "w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                submitting ? "cursor-not-allowed bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700",
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
                {[
                  { key: "sell", label: "팝니다" },
                  { key: "buy", label: "삽니다" },
                  { key: "my_posts", label: "내가 등록한 거래" },
                  { key: "my_requests", label: "내 거래 신청" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setViewTab(tab.key as ArcaViewTab);

                      if (tab.key === "my_requests") {
                        toast.message("내 거래 신청 탭으로 이동했습니다.");
                      } else if (tab.key === "my_posts") {
                        toast.message("내가 등록한 거래 탭으로 이동했습니다.");
                      }
                    }}
                    className={classNames(
                      "rounded-xl px-4 py-2 text-sm font-semibold transition",
                      viewTab === tab.key
                        ? "bg-emerald-600 text-white"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {(viewTab === "sell" || viewTab === "buy") && (
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
              )}
            </div>
          </div>

          {(viewTab === "sell" || viewTab === "buy") && (
            <>
              <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-amber-900">광고 상품</h3>
                    <p className="text-sm text-amber-700">
                      Pro 사용자가 올린 상단 노출 글입니다.
                    </p>
                  </div>
                  <div className="text-xs text-amber-700">최대 {FEATURED_LIMIT}개 노출</div>
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
                          <span className="text-xs text-zinc-500">{formatDate(post.created_at)}</span>
                        </div>

                        <div className="mt-3 text-sm font-semibold text-zinc-900">
                          {post.title || `${TAB_LABEL[post.post_type]} 글`}
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-zinc-700">
                          <div>비율: {formatNumber(post.ratio)} : 1</div>
                          <div>수량: {formatNumber(post.arca_amount)} 아르카</div>
                          <div>
                            거래방식:{" "}
                            {post.trade_mode === "bulk"
                              ? "일괄"
                              : `분할 (${formatNumber(post.split_unit ?? 0)}단위)`}
                          </div>
                          <div>등록자: {post.seller_mc_nickname || post.seller_display_name || "익명"}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {viewTab === "sell" ? "판매 상품 목록" : "구매 상품 목록"}
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
                        <th className="px-4 py-3 text-left font-medium">남은 수량</th>
                        <th className="px-4 py-3 text-left font-medium">총 셀</th>
                        <th className="px-4 py-3 text-left font-medium">작성자</th>
                        <th className="px-4 py-3 text-left font-medium">등록일</th>
                        <th className="px-4 py-3 text-left font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingPosts ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                            목록을 불러오는 중...
                          </td>
                        </tr>
                      ) : listPosts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
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
                            <td className="px-4 py-3">{formatNumber(getRemainingQuantity(post))}</td>
                            <td className="px-4 py-3">{formatNumber(post.cell_amount)}셀</td>
                            <td className="px-4 py-3">{post.seller_mc_nickname || "익명"}</td>
                            <td className="px-4 py-3 text-zinc-500">{formatDate(post.created_at)}</td>
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
                      {completedStats.tradeCount > 0 ? `${completedStats.averageRatio}:1` : "-"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                    <div className="text-xs text-zinc-500">최근 누적 거래량</div>
                    <div className="mt-2 text-xl font-bold text-zinc-900">
                      {formatNumber(completedStats.totalArca)} 아르카
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {viewTab === "my_posts" && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-lg font-semibold text-zinc-900">내가 등록한 거래</div>
                <div className="text-sm text-zinc-500">
                  총 {formatNumber(myPosts.length)}건 / {myPostsPage}페이지
                </div>
              </div>

              {myPosts.length === 0 ? (
                <div className="text-sm text-zinc-500">등록한 거래글이 없습니다.</div>
              ) : (
                <>
                  <div className="space-y-4">
                    {pagedMyPosts.map((post) => {
                      const postRequests = receivedRequestsByPostId[post.id] ?? [];
                      const summary = getRequestSummaryCounts(postRequests);
                      const { currentPage, totalPages, paged } = getPagedRequestsForPost(
                        post.id,
                        postRequests,
                      );

                      return (
                        <div key={post.id} className="rounded-xl border border-zinc-200 px-4 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="text-sm text-zinc-700">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium text-zinc-900">
                                  {post.title || `${post.post_type === "sell" ? "판매" : "구매"} 거래`}
                                </div>

                                <span
                                  className={classNames(
                                    "rounded-full px-2 py-1 text-xs font-semibold",
                                    post.post_type === "sell"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-sky-100 text-sky-700",
                                  )}
                                >
                                  {post.post_type === "sell" ? "판매글" : "구매글"}
                                </span>

                                <span
                                  className={classNames(
                                    "rounded-full px-2 py-1 text-xs font-semibold",
                                    post.status === "open"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : post.status === "completed"
                                        ? "bg-sky-100 text-sky-700"
                                        : "bg-red-100 text-red-700",
                                  )}
                                >
                                  {post.status === "open"
                                    ? "진행중"
                                    : post.status === "completed"
                                      ? "완료"
                                      : "취소"}
                                </span>

                                {summary.pending > 0 && (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                    진행중 신청 {summary.pending}건
                                  </span>
                                )}
                                {summary.completed > 0 && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                    완료 {summary.completed}건
                                  </span>
                                )}
                                {summary.cancelled > 0 && (
                                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                    취소 {summary.cancelled}건
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl bg-zinc-50 px-3 py-3">
                                  <div className="text-xs text-zinc-500">총 등록 수량</div>
                                  <div className="mt-1 font-semibold text-zinc-900">
                                    {formatNumber(post.arca_amount)} 아르카
                                  </div>
                                </div>
                                <div className="rounded-xl bg-zinc-50 px-3 py-3">
                                  <div className="text-xs text-zinc-500">예약 수량</div>
                                  <div className="mt-1 font-semibold text-zinc-900">
                                    {formatNumber(post.reserved_quantity)} 아르카
                                  </div>
                                </div>
                                <div className="rounded-xl bg-zinc-50 px-3 py-3">
                                  <div className="text-xs text-zinc-500">완료 수량</div>
                                  <div className="mt-1 font-semibold text-zinc-900">
                                    {formatNumber(post.completed_quantity)} 아르카
                                  </div>
                                </div>
                                <div className="rounded-xl bg-zinc-50 px-3 py-3">
                                  <div className="text-xs text-zinc-500">남은 수량</div>
                                  <div className="mt-1 font-semibold text-zinc-900">
                                    {formatNumber(getRemainingQuantity(post))} 아르카
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 space-y-1">
                                <div>비율: {formatNumber(post.ratio)} : 1</div>
                                <div>
                                  거래 방식:{" "}
                                  {post.trade_mode === "bulk"
                                    ? "일괄"
                                    : `분할 (${formatNumber(post.split_unit ?? 0)}단위)`}
                                </div>
                                <div>등록일: {formatDate(post.created_at)}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailPost(post)}
                                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold shadow-sm text-white"
                              >
                                글 상세보기
                              </button>

                              {post.status === "open" ? (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelPost(post)}
                                   className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                                >
                                  글 취소
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleDeletePost(post)}
                                   className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-zinc-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <div className="text-sm font-semibold text-zinc-900">
                                신청 목록 ({postRequests.length})
                              </div>

                              {postRequests.length > REQUESTS_PER_POST_PAGE && (
                                <div className="text-xs text-zinc-500">
                                  {currentPage} / {totalPages} 페이지
                                </div>
                              )}
                            </div>

                            {postRequests.length === 0 ? (
                              <div className="text-sm text-zinc-500">아직 들어온 신청이 없습니다.</div>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {paged.map((req) => (
                                    <div
                                      key={req.id}
                                      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 md:flex-row md:items-center md:justify-between"
                                    >
                                      <div className="text-sm text-zinc-700">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className={classNames(
                                              "rounded-full px-2 py-1 text-xs font-semibold",
                                              getStepStatusBadgeClass(req),
                                            )}
                                          >
                                            {getStepStatusText(req)}
                                          </span>
                                          <span
                                            className={classNames(
                                              "rounded-full px-2 py-1 text-xs font-semibold",
                                              getActionStatusBadgeClass(req, sessionUserId),
                                            )}
                                          >
                                            {getActionStatusText(req, sessionUserId)}
                                          </span>
                                        </div>

                                        <div className="mt-2">신청자 닉네임: {getRequesterName(req)}</div>
                                        <div>신청 수량: {formatNumber(req.request_quantity)} 아르카</div>
                                        <div>비율: {formatNumber(req.ratio)} : 1</div>
                                        <div className="text-xs text-zinc-500">
                                          상태: {getRequestStatusLabel(req)} /{" "}
                                          {getCompletionProgressLabel(req, sessionUserId)}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setDetailRequest(req)}
                                          className="min-w-[96px] rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                                        >
                                          상세보기
                                        </button>

                                        {req.status === "pending" && !req.owner_completed_at && (
                                          <button
                                            type="button"
                                            onClick={() => void handleCompleteRequest(req)}
                                            disabled={requestSubmitting}
                                            className="min-w-[96px] rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            거래 완료
                                          </button>
                                        )}

                                        {req.status === "pending" && req.owner_completed_at && (
                                          <span className="text-xs font-medium text-sky-700">
                                            내 완료 확인 반영됨
                                          </span>
                                        )}

                                        {req.status !== "pending" && (
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteRequest(req)}
                                            className="min-w-[96px] rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
                                          >
                                            삭제
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {postRequests.length > REQUESTS_PER_POST_PAGE && (
                                  <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPostRequestPages((prev) => ({
                                          ...prev,
                                          [post.id]: Math.max(1, (prev[post.id] ?? 1) - 1),
                                        }))
                                      }
                                      disabled={currentPage <= 1}
                                      className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      이전
                                    </button>
                                    <span className="text-xs text-zinc-600">
                                      {currentPage} / {totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPostRequestPages((prev) => ({
                                          ...prev,
                                          [post.id]: Math.min(totalPages, (prev[post.id] ?? 1) + 1),
                                        }))
                                      }
                                      disabled={currentPage >= totalPages}
                                      className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      다음
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMyPostsPage((prev) => Math.max(1, prev - 1))}
                      disabled={myPostsPage <= 1}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      이전
                    </button>
                    <span className="text-sm text-zinc-700">
                      {myPostsPage} / {myPostsTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMyPostsPage((prev) => Math.min(myPostsTotalPages, prev + 1))}
                      disabled={myPostsPage >= myPostsTotalPages}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {viewTab === "my_requests" && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-lg font-semibold text-zinc-900">내 거래 신청</div>
                <div className="text-sm text-zinc-500">
                  총 {formatNumber(myRequests.length)}건 / {myRequestsPage}페이지
                </div>
              </div>

              {loadingRequests ? (
                <div className="text-sm text-zinc-500">불러오는 중...</div>
              ) : myRequests.length === 0 ? (
                <div className="text-sm text-zinc-500">신청 내역이 없습니다.</div>
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedMyRequests.map((req) => {
                      const canRequesterComplete =
                        req.status === "pending" && !req.requester_completed_at;

                      const canRequesterCancel =
                        req.status === "pending" &&
                        !req.requester_completed_at &&
                        !req.owner_completed_at;

                      return (
                        <div
                          key={req.id}
                          className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="text-sm text-zinc-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-zinc-900">
                                {req.title?.trim() || `${req.post_type === "sell" ? "판매" : "구매"} 거래글`}
                              </div>

                              <span
                                className={classNames(
                                  "rounded-full px-2 py-1 text-xs font-semibold",
                                  getStepStatusBadgeClass(req),
                                )}
                              >
                                {getStepStatusText(req)}
                              </span>

                              <span
                                className={classNames(
                                  "rounded-full px-2 py-1 text-xs font-semibold",
                                  getActionStatusBadgeClass(req, sessionUserId),
                                )}
                              >
                                {getActionStatusText(req, sessionUserId)}
                              </span>
                            </div>

                            <div className="mt-2">상대 닉네임: {getCounterpartyName(req)}</div>
                            <div>원본 글 유형: {req.post_type === "sell" ? "판매글" : "구매글"}</div>
                            <div>
                              거래 방식:{" "}
                              {req.trade_mode === "bulk"
                                ? "일괄"
                                : `분할 (${formatNumber(req.split_unit ?? 0)}단위)`}
                            </div>
                            <div>총 등록 수량: {formatNumber(req.arca_amount ?? 0)} 아르카</div>
                            <div>신청 수량: {formatNumber(req.request_quantity)} 아르카</div>
                            <div>비율: {formatNumber(req.ratio)} : 1</div>
                            <div className="text-xs text-zinc-500">
                              상태: {getRequestStatusLabel(req)} /{" "}
                              {getCompletionProgressLabel(req, sessionUserId)}
                            </div>
                          </div>

                          <div className="flex min-w-[240px] flex-col items-start gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDetailRequest(req)}
                                className="min-w-[96px] rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                              >
                                상세보기
                              </button>

                              {canRequesterComplete && (
                                <button
                                  type="button"
                                  onClick={() => void handleCompleteRequest(req)}
                                  disabled={requestSubmitting}
                                  className="min-w-[96px] rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  거래 완료
                                </button>
                              )}

                              {canRequesterCancel && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelRequest(req)}
                                  disabled={requestSubmitting}
                                   className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                                >
                                  취소
                                </button>
                              )}

                              {req.status !== "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRequest(req)}
                                  className="min-w-[96px] rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
                                >
                                  삭제
                                </button>
                              )}
                            </div>

                            {req.status === "pending" && req.requester_completed_at && (
                              <div className="text-xs font-medium text-sky-700">
                                내 완료 확인 반영됨 · 상대방 완료 대기 중
                              </div>
                            )}

                            {req.status === "pending" &&
                              !req.requester_completed_at &&
                              req.owner_completed_at && (
                                <div className="text-xs font-medium text-amber-700">
                                  상대방이 먼저 완료 확인함 · 내 완료 확인 필요
                                </div>
                              )}

                            {req.status === "pending" &&
                              !req.requester_completed_at &&
                              !req.owner_completed_at && (
                                <div className="text-xs text-zinc-500">
                                  아직 양측 완료 확인 전입니다. 거래 후 완료 버튼을 눌러 주세요.
                                </div>
                              )}

                            {req.status === "completed" && (
                              <div className="text-xs font-medium text-emerald-700">
                                거래가 최종 완료되었습니다. 삭제 버튼으로 목록 정리가 가능합니다.
                              </div>
                            )}

                            {req.status === "cancelled" && (
                              <div className="text-xs font-medium text-red-700">
                                취소된 신청입니다. 필요하면 삭제 버튼으로 정리할 수 있습니다.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMyRequestsPage((prev) => Math.max(1, prev - 1))}
                      disabled={myRequestsPage <= 1}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      이전
                    </button>
                    <span className="text-sm text-zinc-700">
                      {myRequestsPage} / {myRequestsTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMyRequestsPage((prev) => Math.min(myRequestsTotalPages, prev + 1))
                      }
                      disabled={myRequestsPage >= myRequestsTotalPages}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
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
                  <span
                    className={classNames(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      detailPost.status === "open"
                        ? "bg-emerald-100 text-emerald-700"
                        : detailPost.status === "completed"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-red-100 text-red-700",
                    )}
                  >
                    {detailPost.status === "open"
                      ? "진행중"
                      : detailPost.status === "completed"
                        ? "완료"
                        : "취소"}
                  </span>
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
                  <div className="text-xs text-zinc-500">총 등록 수량</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.arca_amount)} 아르카
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">예약 수량</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.reserved_quantity)} 아르카
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">완료 수량</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(detailPost.completed_quantity)} 아르카
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">남은 수량</div>
                  <div className="mt-2 text-xl font-bold text-zinc-900">
                    {formatNumber(getRemainingQuantity(detailPost))} 아르카
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
                <div className="text-sm font-semibold text-zinc-900">등록자 정보</div>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <div>등록자: {detailPost.seller_mc_nickname || "익명"}</div>
                  <div>
                    연락 방식: {detailPost.contact_preference === "discord" ? "디스코드" : "귓말"}
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

                {detailPost.user_id !== sessionUserId && detailPost.status === "open" && (
                  <div className="flex flex-wrap items-end gap-2">
                    {detailPost.trade_mode === "split" && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          신청 수량
                        </label>
                        <input
                          value={requestQuantity}
                          onChange={(e) => setRequestQuantity(e.target.value)}
                          inputMode="numeric"
                          className="w-36 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                          placeholder="예: 10"
                        />
                      </div>
                    )}

                    {detailPost.trade_mode === "bulk" && (
                      <div className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                        일괄 거래: 전체 수량 {formatNumber(detailPost.arca_amount)} 아르카 신청
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleCreateTradeRequest(detailPost)}
                      disabled={requestSubmitting}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {requestSubmitting
                        ? "신청 중..."
                        : detailPost.post_type === "sell"
                          ? "구매 신청"
                          : "판매 신청"}
                    </button>
                  </div>
                )}

                {detailPost.user_id === sessionUserId && detailPost.status === "open" && (
                  <button
                    type="button"
                    onClick={() => void handleCancelPost(detailPost)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                  >
                    글 취소
                  </button>
                )}

                {detailPost.user_id === sessionUserId && detailPost.status !== "open" && (
                  <button
                    type="button"
                    onClick={() => void handleDeletePost(detailPost)}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <div className="text-xs font-semibold text-zinc-500">거래 신청 상세</div>
                <h3 className="mt-2 text-xl font-bold text-zinc-900">
                  {detailRequest.title?.trim() || "신청 상세"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">현재 상태</div>
                  <div className="mt-2">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-1 text-xs font-semibold",
                        getStepStatusBadgeClass(detailRequest),
                      )}
                    >
                      {getStepStatusText(detailRequest)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {getActionStatusText(detailRequest, sessionUserId)}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">내 완료 여부</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {sessionUserId === detailRequest.requester_id
                      ? detailRequest.requester_completed_at
                        ? "완료"
                        : "미완료"
                      : sessionUserId === detailRequest.owner_id
                        ? detailRequest.owner_completed_at
                          ? "완료"
                          : "미완료"
                        : "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">상대 완료 여부</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {sessionUserId === detailRequest.requester_id
                      ? detailRequest.owner_completed_at
                        ? "완료"
                        : "미완료"
                      : sessionUserId === detailRequest.owner_id
                        ? detailRequest.requester_completed_at
                          ? "완료"
                          : "미완료"
                        : "-"}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">원본 글 유형</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {detailRequest.post_type === "sell" ? "판매글" : "구매글"}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">거래 방식</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {detailRequest.trade_mode === "bulk"
                     ? "일괄"
                     : `분할 (${formatNumber(detailRequest.split_unit ?? 0)}단위)`}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">총 등록 수량</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {formatNumber(detailRequest.arca_amount ?? 0)} 아르카
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">신청 수량</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {formatNumber(detailRequest.request_quantity)} 아르카
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-50 px-4 py-4">
                  <div className="text-xs text-zinc-500">비율</div>
                  <div className="mt-2 text-base font-semibold text-zinc-900">
                    {formatNumber(detailRequest.ratio)} : 1
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-sm font-semibold text-zinc-900">거래 당사자</div>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  <div>신청자: {getRequesterName(detailRequest)}</div>
                  <div>등록자: {getOwnerName(detailRequest)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {detailRequest.status === "pending" &&
                  sessionUserId === detailRequest.requester_id &&
                  !detailRequest.requester_completed_at && (
                    <button
                      type="button"
                      onClick={() => void handleCompleteRequest(detailRequest)}
                      disabled={requestSubmitting}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                      거래 완료
                    </button>
                  )}

                {detailRequest.status === "pending" &&
                  sessionUserId === detailRequest.requester_id &&
                  !detailRequest.requester_completed_at &&
                  !detailRequest.owner_completed_at && (
                    <button
                      type="button"
                      onClick={() => void handleCancelRequest(detailRequest)}
                      disabled={requestSubmitting}
                      className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50"
                    >
                      취소
                    </button>
                  )}

                {detailRequest.status !== "pending" && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteRequest(detailRequest)}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}