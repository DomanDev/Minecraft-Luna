"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ArcaMarketSummaryCard from "@/src/components/market/ArcaMarketSummaryCard";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/hooks/useAuth";

/**
 * =========================
 * 메인 홈 페이지
 * =========================
 * 이번 수정 목표:
 * 1) 운영 안내(공지/패치/이벤트/점검) 클릭 시 상세 내용을 모달로 확인
 * 2) 관리자 전용 글쓰기 / 수정 / 삭제 기능 추가
 * 3) 아르카 시세 표를 페이지 가로 전체 폭으로 확장
 * 4) 메인 전체 색감을 silver / slate / zinc 기반으로 통일
 * 5) 기존 파랑/초록/노랑 강조 카드 느낌을 줄이고, 고급스러운 카드 톤으로 정리
 *
 * 참고:
 * - 운영 안내는 home_board_posts 테이블을 사용한다.
 * - 아르카 시세는 기존 공개 코드의 ArcaMarketSummaryCard와 동일하게
 *   arca_trade_posts(status=completed)의 최근 20건 기준으로 계산한다.
 */

/**
 * 운영 안내 카테고리 타입
 */
type BoardCategory = "notice" | "patch" | "event" | "maintenance";

/**
 * 운영 안내 게시글 타입
 */
type HomeBoardPost = {
  id: string;
  category: BoardCategory;
  title: string;
  summary: string | null;
  content: string;
  label_date: string | null;
  is_visible: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
};

/**
 * 아르카 최근 거래 요약용 타입
 */
type ArcaTradeSummaryRow = {
  id: string;
  ratio: number;
  arca_amount: number;
  completed_at: string | null;
};

/**
 * 운영 안내용 폼 상태
 */
type BoardFormState = {
  category: BoardCategory;
  title: string;
  summary: string;
  content: string;
  label_date: string;
  display_order: number;
  is_visible: boolean;
};

/**
 * 관리자 판별용 상수
 *
 * 중요:
 * - 가장 안전한 방식은 user.id(UUID) 기준
 * - 아래 배열에 실제 관리자 auth uid를 넣으면 된다
 * - 추후 profiles.role 컬럼을 만들면 그 방식으로 교체 가능
 */
const ADMIN_USER_IDS = [
  "23fadabe-20c9-4e80-9e88-ee4dc24de518",
];

/**
 * 카테고리 메타 정보
 */
const BOARD_META: Record<
  BoardCategory,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  notice: {
    title: "공지사항",
    description: "가장 먼저 확인해야 하는 안내",
    emptyTitle: "공지 등록 예정",
    emptyBody: "운영 공지, 중요 안내, 서버 이용 관련 알림을 이 영역에 표시합니다.",
  },
  patch: {
    title: "패치노트",
    description: "업데이트 및 기능 변경 내역",
    emptyTitle: "패치노트 등록 예정",
    emptyBody: "업데이트 내용, 변경 사항, 버그 수정 내역을 이 영역에 표시합니다.",
  },
  event: {
    title: "이벤트",
    description: "진행 중이거나 예정된 이벤트",
    emptyTitle: "이벤트 등록 예정",
    emptyBody: "서버 이벤트, 시즌 콘텐츠, 보상 일정을 이 영역에 표시합니다.",
  },
  maintenance: {
    title: "점검일자",
    description: "정기/임시 점검 안내",
    emptyTitle: "점검 일정 등록 예정",
    emptyBody: "정기 점검, 임시 점검, 업데이트 적용 시간을 이 영역에 표시합니다.",
  },
};

/**
 * 운영 안내 글쓰기/수정용 초기값
 */
const INITIAL_FORM: BoardFormState = {
  category: "notice",
  title: "",
  summary: "",
  content: "",
  label_date: "",
  display_order: 0,
  is_visible: true,
};

/**
 * 숫자 포맷 유틸
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

/**
 * 날짜 표시 유틸
 * - 게시글 label_date가 있으면 우선 표시
 * - 없으면 created_at 기준으로 간단히 보여줄 때 사용 가능
 */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 히어로 우측 정보 카드
 * - 과한 컬러를 빼고 silver/slate 톤으로 통일
 * - 같은 구조 반복을 줄이기 위해 보조 컴포넌트로 분리
 */
function PremiumInfoCard(props: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: "emerald" | "sky";
}) {
  const { eyebrow, title, description, tone = "emerald" } = props;

  const toneClass =
    tone === "sky"
      ? {
          wrapper:
            "border-sky-200 bg-gradient-to-br from-white via-sky-50 to-cyan-50 ring-1 ring-sky-100",
          badge:
            "border-sky-200 bg-white text-sky-700",
          title: "text-zinc-900",
          desc: "text-zinc-700",
        }
      : {
          wrapper:
            "border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-teal-50 ring-1 ring-emerald-100",
          badge:
            "border-emerald-200 bg-white text-emerald-700",
          title: "text-zinc-900",
          desc: "text-zinc-700",
        };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass.wrapper}`}>
      <div
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm ${toneClass.badge}`}
      >
        {eyebrow}
      </div>

      <p className={`mt-4 text-2xl font-bold tracking-tight ${toneClass.title}`}>
        {title}
      </p>

      <p className={`mt-2 text-sm leading-6 ${toneClass.desc}`}>
        {description}
      </p>
    </div>
  );
}

/**
 * 운영 안내 상세 보기 모달
 */
function NoticeDetailModal(props: {
  open: boolean;
  post: HomeBoardPost | null;
  onClose: () => void;
}) {
  const { open, post, onClose } = props;

  if (!open || !post) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-zinc-500">
              {BOARD_META[post.category].title}
            </p>
            <h3 className="mt-1 text-2xl font-bold text-zinc-900">{post.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">
              {post.label_date || formatDateTime(post.created_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>

        <div className="px-6 py-5">
          {post.summary ? (
            <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm leading-6 text-zinc-700">{post.summary}</p>
            </div>
          ) : null}

          <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">
            {post.content}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 운영 안내 글쓰기 / 수정 모달
 */
function BoardEditorModal(props: {
  open: boolean;
  mode: "create" | "edit";
  form: BoardFormState;
  saving: boolean;
  onClose: () => void;
  onChange: (next: BoardFormState) => void;
  onSubmit: () => void;
}) {
  const { open, mode, form, saving, onClose, onChange, onSubmit } = props;

  if (!open) return null;

  const title = mode === "create" ? "운영 안내 글쓰기" : "운영 안내 글 수정";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
          <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">구분</span>
            <select
              value={form.category}
              onChange={(e) =>
                onChange({
                  ...form,
                  category: e.target.value as BoardCategory,
                })
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800"
            >
              <option value="notice">공지사항</option>
              <option value="patch">패치노트</option>
              <option value="event">이벤트</option>
              <option value="maintenance">점검일자</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">표시 날짜</span>
            <input
              value={form.label_date}
              onChange={(e) => onChange({ ...form, label_date: e.target.value })}
              placeholder="예: 2026-04-06 / 진행 중 / 상시"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">제목</span>
            <input
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              placeholder="게시글 제목 입력"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">요약</span>
            <input
              value={form.summary}
              onChange={(e) => onChange({ ...form, summary: e.target.value })}
              placeholder="목록 카드에 짧게 보일 설명"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">본문</span>
            <textarea
              value={form.content}
              onChange={(e) => onChange({ ...form, content: e.target.value })}
              placeholder="모달에서 보여줄 상세 내용"
              rows={10}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-800"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zinc-800">표시 순서</span>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) =>
                onChange({
                  ...form,
                  display_order: Number(e.target.value || 0),
                })
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-800"
            />
          </label>

          <label className="flex items-center gap-3 pt-8">
            <input
              type="checkbox"
              checked={form.is_visible}
              onChange={(e) => onChange({ ...form, is_visible: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm font-medium text-zinc-700">게시글 표시</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "저장 중..." : mode === "create" ? "등록하기" : "수정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 운영 안내 섹션 컴포넌트
 * - 카드 클릭 시 상세 모달 오픈
 * - 관리자면 글쓰기 / 수정 / 삭제 버튼 표시
 */
function SectionBoard(props: {
  category: BoardCategory;
  items: HomeBoardPost[];
  isAdmin: boolean;
  onOpenDetail: (post: HomeBoardPost) => void;
  onCreate: (category: BoardCategory) => void;
  onEdit: (post: HomeBoardPost) => void;
  onDelete: (post: HomeBoardPost) => void;
}) {
  const { category, items, isAdmin, onOpenDetail, onCreate, onEdit, onDelete } = props;
  const meta = BOARD_META[category];

  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-zinc-100 p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-600 shadow-sm">
            {meta.title.toUpperCase?.() ?? meta.title}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-zinc-900">{meta.title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{meta.description}</p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => onCreate(category)}
            className="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
          >
            글쓰기
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">{meta.emptyTitle}</h3>
              <span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                준비 중
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{meta.emptyBody}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              {/* =========================
                  게시글 본문 클릭 영역
                  - 카드 전체를 button으로 감싸지 않고
                  - 클릭이 필요한 본문 영역만 button 처리
                  - 이렇게 해야 관리자용 수정/삭제 버튼과 중첩되지 않음
              ========================= */}
              <button
                type="button"
                onClick={() => onOpenDetail(item)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-900">{item.title}</h3>
                  <span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                    {item.label_date || formatDateTime(item.created_at)}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {item.summary || item.content}
                </p>
              </button>

              {/* =========================
                  관리자 버튼 영역
                  - 바깥 클릭 버튼과 분리해서 배치
                  - nested button 오류 방지
              ========================= */}
              {isAdmin ? (
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();

  /**
   * 운영 안내 전체 글 목록
   */
  const [boardPosts, setBoardPosts] = useState<HomeBoardPost[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);

  /**
   * 운영 안내 상세 모달 상태
   */
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<HomeBoardPost | null>(null);

  /**
   * 관리자 편집 모달 상태
   */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [form, setForm] = useState<BoardFormState>(INITIAL_FORM);
  const [formSaving, setFormSaving] = useState(false);

  /**
   * 아르카 시세 표 실데이터 상태
   */
  const [arcaRows, setArcaRows] = useState<ArcaTradeSummaryRow[]>([]);
  const [arcaLoading, setArcaLoading] = useState(true);

  /**
   * 관리자 여부
   */
  const isAdmin = !!user && ADMIN_USER_IDS.includes(user.id);

  /**
   * 운영 안내 글 목록 조회
   */
  useEffect(() => {
    let mounted = true;

    async function fetchBoardPosts() {
      setBoardLoading(true);

      const { data, error } = await supabase
        .from("home_board_posts")
        .select(
          "id, category, title, summary, content, label_date, is_visible, display_order, created_at, updated_at, author_id"
        )
        .eq("is_visible", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("운영 안내 게시글 조회 실패:", error.message);
        if (mounted) {
          setBoardPosts([]);
          setBoardLoading(false);
        }
        return;
      }

      if (mounted) {
        setBoardPosts((data ?? []) as HomeBoardPost[]);
        setBoardLoading(false);
      }
    }

    void fetchBoardPosts();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 아르카 최근 완료 거래 요약 조회
   *
   * 공개 코드의 ArcaMarketSummaryCard와 같은 기준:
   * - arca_trade_posts
   * - status = completed
   * - completed_at desc
   * - 최근 20건
   */
  useEffect(() => {
    let mounted = true;

    async function fetchArcaSummary() {
      setArcaLoading(true);

      const { data, error } = await supabase
        .from("arca_trade_posts")
        .select("id, ratio, arca_amount, completed_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("메인 아르카 시세 조회 실패:", error.message);
        if (mounted) {
          setArcaRows([]);
          setArcaLoading(false);
        }
        return;
      }

      if (mounted) {
        setArcaRows((data ?? []) as ArcaTradeSummaryRow[]);
        setArcaLoading(false);
      }
    }

    void fetchArcaSummary();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 카테고리별 게시글 묶음
   */
  const postsByCategory = useMemo(() => {
    return {
      notice: boardPosts.filter((post) => post.category === "notice").slice(0, 4),
      patch: boardPosts.filter((post) => post.category === "patch").slice(0, 4),
      event: boardPosts.filter((post) => post.category === "event").slice(0, 4),
      maintenance: boardPosts.filter((post) => post.category === "maintenance").slice(0, 4),
    };
  }, [boardPosts]);

  /**
   * 아르카 요약 계산
   */
  const arcaSummary = useMemo(() => {
    if (arcaRows.length === 0) {
      return {
        tradeCount: 0,
        averageRatio: 0,
        totalArca: 0,
      };
    }

    const totalRatio = arcaRows.reduce((sum, row) => sum + Number(row.ratio ?? 0), 0);
    const totalArca = arcaRows.reduce((sum, row) => sum + Number(row.arca_amount ?? 0), 0);

    return {
      tradeCount: arcaRows.length,
      averageRatio: Math.round((totalRatio / arcaRows.length) * 100) / 100,
      totalArca,
    };
  }, [arcaRows]);

  /**
   * 상세 모달 열기
   */
  const openDetailModal = (post: HomeBoardPost) => {
    setSelectedPost(post);
    setDetailOpen(true);
  };

  /**
   * 글쓰기 모달 열기
   */
  const openCreateModal = (category: BoardCategory) => {
    setEditorMode("create");
    setEditingPostId(null);
    setForm({
      ...INITIAL_FORM,
      category,
    });
    setEditorOpen(true);
  };

  /**
   * 수정 모달 열기
   */
  const openEditModal = (post: HomeBoardPost) => {
    setEditorMode("edit");
    setEditingPostId(post.id);
    setForm({
      category: post.category,
      title: post.title,
      summary: post.summary ?? "",
      content: post.content,
      label_date: post.label_date ?? "",
      display_order: post.display_order ?? 0,
      is_visible: post.is_visible,
    });
    setEditorOpen(true);
  };

  /**
   * 게시글 저장
   */
  const handleSavePost = async () => {
    if (!isAdmin) return;

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || !content) {
      alert("제목과 본문은 필수입니다.");
      return;
    }

    setFormSaving(true);

    try {
      if (editorMode === "create") {
        const { error } = await supabase.from("home_board_posts").insert({
          category: form.category,
          title,
          summary: form.summary.trim() || null,
          content,
          label_date: form.label_date.trim() || null,
          display_order: Number(form.display_order || 0),
          is_visible: form.is_visible,
          author_id: user?.id ?? null,
        });

        if (error) {
          alert(`게시글 등록 실패: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase
          .from("home_board_posts")
          .update({
            category: form.category,
            title,
            summary: form.summary.trim() || null,
            content,
            label_date: form.label_date.trim() || null,
            display_order: Number(form.display_order || 0),
            is_visible: form.is_visible,
          })
          .eq("id", editingPostId);

        if (error) {
          alert(`게시글 수정 실패: ${error.message}`);
          return;
        }
      }

      /**
       * 저장 성공 후 목록 재조회
       */
      const { data, error } = await supabase
        .from("home_board_posts")
        .select(
          "id, category, title, summary, content, label_date, is_visible, display_order, created_at, updated_at, author_id"
        )
        .eq("is_visible", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (!error) {
        setBoardPosts((data ?? []) as HomeBoardPost[]);
      }

      setEditorOpen(false);
      setEditingPostId(null);
      setForm(INITIAL_FORM);
    } finally {
      setFormSaving(false);
    }
  };

  /**
   * 게시글 삭제
   */
  const handleDeletePost = async (post: HomeBoardPost) => {
    if (!isAdmin) return;

    const ok = window.confirm(`"${post.title}" 게시글을 삭제할까요?`);
    if (!ok) return;

    const { error } = await supabase.from("home_board_posts").delete().eq("id", post.id);

    if (error) {
      alert(`게시글 삭제 실패: ${error.message}`);
      return;
    }

    setBoardPosts((prev) => prev.filter((item) => item.id !== post.id));

    if (selectedPost?.id === post.id) {
      setSelectedPost(null);
      setDetailOpen(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* =========================
            상단 히어로 영역
        ========================= */}
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-md">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-10">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                  루나서버 생활 플랫폼
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                  계산기 + 시세 + 프로필 연동
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                  Free / Pro 확장 구조
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                루나서버 생활 콘텐츠를
                <br className="hidden sm:block" />
                한 화면에서 보는 통합 웹 서비스
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 sm:text-lg">
                낚시, 농사, 채광, 요리, 강화 계산기와 시세 기록, 아르카 거래,
                프로필 자동 반영 기능까지
                <br />
                연결하는 서비스형 메인 페이지입니다.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  프로필 연동하러 가기
                </Link>

                <Link
                  href="/market-prices"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                >
                  시세 탭 보기
                </Link>
              </div>
            </div>

            {/* =========================
                우측 강조 카드
                - 기존 컬러 강조를 제거하고
                - silver/slate 기반 고급스러운 카드로 정리
            ========================= */}
            <div className="grid gap-4 lg:grid-cols-1">
              <PremiumInfoCard
                eyebrow="CORE FEATURE"
                title="생활 계산기 통합"
                description="낚시, 농사, 요리, 강화, 채광 계산기와 시세 기록 기능을 한 플랫폼에서 자연스럽게 연결합니다."
                tone="emerald"
              />

              <PremiumInfoCard
                eyebrow="PROFILE LINK"
                title="프로필 기반"
                description="저장된 생활 스탯과 도감 효과를 계산기에 자동 반영하는 흐름을 지원합니다."
                tone="sky"
              />
            </div>
          </div>
        </section>

        {/* =========================
            운영 안내
        ========================= */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-zinc-900">운영 안내</h2>
            <p className="mt-1 text-sm text-zinc-600">
              공지사항, 패치노트, 이벤트, 점검 일정을 확인할 수 있습니다.
            </p>
          </div>

          {boardLoading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              운영 안내를 불러오는 중...
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
              <SectionBoard
                category="notice"
                items={postsByCategory.notice}
                isAdmin={isAdmin}
                onOpenDetail={openDetailModal}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={handleDeletePost}
              />
              <SectionBoard
                category="patch"
                items={postsByCategory.patch}
                isAdmin={isAdmin}
                onOpenDetail={openDetailModal}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={handleDeletePost}
              />
              <SectionBoard
                category="event"
                items={postsByCategory.event}
                isAdmin={isAdmin}
                onOpenDetail={openDetailModal}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={handleDeletePost}
              />
              <SectionBoard
                category="maintenance"
                items={postsByCategory.maintenance}
                isAdmin={isAdmin}
                onOpenDetail={openDetailModal}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={handleDeletePost}
              />
            </div>
          )}
        </section>

        {/* =========================
            아르카 시세 표
            - 실버톤으로 통일
            - 기존 과한 컬러 카드 제거
        ========================= */}
        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-md">
          <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-slate-600 shadow-sm">
                MARKET OVERVIEW
              </div>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
                아르카 시세 표
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                아르카샵 최근 완료 거래 기준으로 최근 시세 흐름을 한눈에 볼 수 있는 영역입니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/arka-market"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                거래소 가기
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-300 bg-gradient-to-br from-[#fffdf7] via-[#fff4d6] to-[#fde7b0] p-5 shadow-sm ring-1 ring-amber-200">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">최근 완료 거래 기준 시세 요약</h3>
                <p className="mt-1 text-sm text-zinc-700">
                  최근 체결 데이터를 바탕으로 거래 흐름을 빠르게 확인할 수 있습니다.
                </p>
              </div>

              <span className="inline-flex w-fit items-center rounded-full border border-amber-300 bg-white/95 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
                최근 20건 기준
              </span>
            </div>

            {arcaLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-base text-slate-600 shadow-sm">
                아르카 최근 거래 데이터를 불러오는 중...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-amber-300 bg-white/92 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-orange-700">최근 완료 거래 수</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-900">
                    {formatNumber(arcaSummary.tradeCount)}
                    <span className="ml-1 text-lg font-bold text-black-800">건</span>
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-700">
                    최근 체결된 거래 수를 기준으로 시장 활성도를 보여줍니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-300 bg-white/92 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-orange-700">최근 평균 비율</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-900">
                    {arcaSummary.tradeCount > 0 ? `${arcaSummary.averageRatio}:1` : "-"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-700">
                    최근 완료 거래 기준 평균 비율입니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-300 bg-white/92 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-orange-700">최근 거래 총 아르카</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-900">
                    {formatNumber(arcaSummary.totalArca)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-700">
                    최근 완료된 거래들의 총 아르카 물량입니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* =========================
              아르카 최근 시세 카드
              - 수정한 ArcaMarketSummaryCard 디자인과 톤을 맞추기 위해
                외곽 박스도 실버톤으로 정리
          ========================= */}
          {/* <div className="mt-8">
            <ArcaMarketSummaryCard />
          </div> */}
        </section>
      </main>

      {/* 운영 안내 상세 모달 */}
      <NoticeDetailModal
        open={detailOpen}
        post={selectedPost}
        onClose={() => {
          setDetailOpen(false);
          setSelectedPost(null);
        }}
      />

      {/* 운영 안내 관리자 편집 모달 */}
      <BoardEditorModal
        open={editorOpen}
        mode={editorMode}
        form={form}
        saving={formSaving}
        onClose={() => {
          setEditorOpen(false);
          setEditingPostId(null);
          setForm(INITIAL_FORM);
        }}
        onChange={setForm}
        onSubmit={handleSavePost}
      />
    </>
  );
}