import Link from "next/link";
import ArcaMarketSummaryCard from "@/src/components/market/ArcaMarketSummaryCard";

/**
 * =========================
 * 메인 홈 페이지
 * =========================
 * 목표:
 * - 단순 링크 목록 수준의 홈을 실제 서비스형 랜딩 페이지로 개편
 * - 가독성 높은 카드 UI로 정리
 * - 공지 / 패치노트 / 이벤트 / 점검일자 4구간 노출
 * - 아르카 시세 영역을 메인 하단의 큰 박스로 강조
 * - 기존 라우팅 구조는 그대로 유지
 *
 * 주의:
 * - 아직 공지/이벤트/점검 데이터 테이블이 공개 코드 기준으로 확인되지 않았으므로
 *   우선은 "바로 교체 가능한 정적 배열" 형태로 구성한다.
 * - 나중에 Supabase 테이블이 생기면 이 배열만 조회 로직으로 바꾸면 된다.
 */

type NoticeItem = {
  title: string;
  body: string;
  date: string;
  href?: string;
};

type ShortcutItem = {
  title: string;
  description: string;
  href?: string;
  badge: string;
  tone: "emerald" | "sky" | "amber" | "violet" | "rose" | "zinc";
  disabled?: boolean;
};

const noticeItems: NoticeItem[] = [
  {
    title: "공지 등록 예정",
    body: "운영 공지, 중요 안내, 서버 이용 관련 알림을 이 영역에 표시합니다.",
    date: "업데이트 예정",
  },
  {
    title: "프로필 연동 안내",
    body: "Discord 로그인 후 프로필에서 생활 정보를 입력하면 계산기에 자동 반영됩니다.",
    date: "상시",
    href: "/profile",
  },
];

const patchNoteItems: NoticeItem[] = [
  {
    title: "메인 페이지 개편 진행 중",
    body: "기존 단순 홈 구조를 서비스형 랜딩 페이지로 정리하고 있습니다.",
    date: "진행 중",
  },
  {
    title: "요리 계산기 저장 로직 반영",
    body: "재료/결과물 시세 저장 및 희귀 재료 체크 반응 로직이 정리된 상태입니다.",
    date: "최근 반영",
  },
];

const eventItems: NoticeItem[] = [
  {
    title: "이벤트 등록 예정",
    body: "서버 이벤트, 시즌 콘텐츠, 보상 일정 등을 이 영역에 노출할 수 있습니다.",
    date: "준비 중",
  },
];

const maintenanceItems: NoticeItem[] = [
  {
    title: "점검 일정 등록 예정",
    body: "정기 점검, 긴급 점검, 업데이트 적용 시간을 명확하게 안내하는 영역입니다.",
    date: "미정",
  },
];

const shortcuts: ShortcutItem[] = [
  {
    title: "낚시 계산기",
    description: "기대 수익, 경험치, 시간 효율 계산",
    href: "/fishing-calculator",
    badge: "핵심 기능",
    tone: "emerald",
  },
  {
    title: "농사 계산기",
    description: "작물 등급 확률, 기대 수익, 경험치 계산",
    href: "/farming-calculator",
    badge: "생활 콘텐츠",
    tone: "sky",
  },
  {
    title: "요리 계산기",
    description: "일반/일품 확률, 재료 원가, 기대 순이익 계산",
    href: "/cooking-calculator",
    badge: "시세 저장 연동",
    tone: "amber",
  },
  {
    title: "강화 계산기",
    description: "강화 비용과 기대값 계산용 진입점",
    href: "/enhancement-calculator",
    badge: "확장 기능",
    tone: "violet",
  },
  {
    title: "시세 탭",
    description: "시장 시세 확인 및 향후 거래 연동 확장",
    href: "/market-prices",
    badge: "확장 예정",
    tone: "rose",
  },
  {
    title: "아르카 거래소",
    description: "구매/판매, 광고 상품, 시세 통계로 확장될 예정",
    badge: "준비 중",
    tone: "zinc",
    disabled: true,
  },
];

const marketRows = [
  {
    label: "최근 평균 비율",
    value: "최근 완료 거래 기준 자동 집계",
    note: "ArcaMarketSummaryCard와 연동",
  },
  {
    label: "거래량 추이",
    value: "최근 완료 건수/물량 기준 요약",
    note: "향후 일간/주간 통계 확장",
  },
  {
    label: "판매/구매 흐름",
    value: "거래소 페이지 분리 후 본격 반영",
    note: "아이템매니아 스타일 목록 확장 예정",
  },
  {
    label: "광고 상품",
    value: "Pro 유저 상단 노출 영역 예정",
    note: "거래 페이지 상단 광고 슬롯",
  },
];

function toneClasses(tone: ShortcutItem["tone"]) {
  switch (tone) {
    case "emerald":
      return {
        badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        accent: "text-emerald-700",
      };
    case "sky":
      return {
        badge: "bg-sky-50 text-sky-700 border border-sky-200",
        accent: "text-sky-700",
      };
    case "amber":
      return {
        badge: "bg-amber-50 text-amber-700 border border-amber-200",
        accent: "text-amber-700",
      };
    case "violet":
      return {
        badge: "bg-violet-50 text-violet-700 border border-violet-200",
        accent: "text-violet-700",
      };
    case "rose":
      return {
        badge: "bg-rose-50 text-rose-700 border border-rose-200",
        accent: "text-rose-700",
      };
    default:
      return {
        badge: "bg-zinc-100 text-zinc-700 border border-zinc-200",
        accent: "text-zinc-700",
      };
  }
}

function SectionBoard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: NoticeItem[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const content = (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-zinc-100">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900">{item.title}</h3>
                <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                  {item.date}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
            </div>
          );

          if (item.href) {
            return (
              <Link key={`${title}-${item.title}`} href={item.href}>
                {content}
              </Link>
            );
          }

          return <div key={`${title}-${item.title}`}>{content}</div>;
        })}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* =========================
          상단 히어로 영역
      ========================= */}
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-md">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.75fr] lg:px-8 lg:py-10">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                루나서버 생활 플랫폼
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                계산기 + 시세 + 프로필 연동
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                Free / Pro 확장 구조
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              루나서버 생활 콘텐츠를
              <br className="hidden sm:block" />
              한 화면에서 보는 통합 웹 서비스
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 sm:text-lg">
              낚시, 농사, 요리, 강화 계산기와 시세 확인, 아르카 거래 확장,
              프로필 자동 반영 기능까지 연결하는 서비스형 메인 페이지입니다.
              보기 좋은 감성보다 먼저, 바로 읽히는 정보 구조와 빠른 진입을 우선했습니다.
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

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-medium text-emerald-700">핵심 방향</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">가독성 우선</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                흐린 반투명 카드보다 선명한 정보 구조로 정리
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
              <p className="text-sm font-medium text-sky-700">확장 포인트</p>
              <p className="mt-2 text-2xl font-bold text-sky-900">시세 · 거래</p>
              <p className="mt-2 text-sm leading-6 text-sky-800">
                아르카 거래소, 평균 비율, 광고 상품 영역 확장 가능
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-medium text-amber-700">자동 연동</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">프로필 기반</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                저장된 생활 스탯/도감 효과를 계산기에 반영하는 구조
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          계산기 / 주요 기능 진입 카드
      ========================= */}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">빠른 바로가기</h2>
            <p className="mt-1 text-sm text-zinc-600">
              계산기, 프로필, 시세 탭으로 바로 이동할 수 있도록 정리한 영역입니다.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => {
            const tone = toneClasses(item.tone);

            const card = (
              <div
                className={[
                  "h-full rounded-2xl border bg-white p-5 shadow-sm transition",
                  item.disabled
                    ? "cursor-default border-zinc-200 opacity-80"
                    : "border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>
                    {item.badge}
                  </span>
                </div>

                <div className={`mt-4 text-sm font-semibold ${tone.accent}`}>
                  {item.disabled ? "오픈 준비 중" : "바로 이동"}
                </div>
              </div>
            );

            if (item.disabled || !item.href) {
              return <div key={item.title}>{card}</div>;
            }

            return (
              <Link key={item.title} href={item.href}>
                {card}
              </Link>
            );
          })}
        </div>
      </section>

      {/* =========================
          공지 / 패치노트 / 이벤트 / 점검
      ========================= */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-zinc-900">운영 안내</h2>
          <p className="mt-1 text-sm text-zinc-600">
            공지사항, 패치노트, 이벤트, 점검 일정을 네 구간으로 나눠 한 번에 보이도록 배치합니다.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          <SectionBoard
            title="공지사항"
            description="가장 먼저 확인해야 하는 안내"
            items={noticeItems}
          />
          <SectionBoard
            title="패치노트"
            description="업데이트 및 기능 변경 내역"
            items={patchNoteItems}
          />
          <SectionBoard
            title="이벤트"
            description="진행 중이거나 예정된 이벤트"
            items={eventItems}
          />
          <SectionBoard
            title="점검일자"
            description="정기/임시 점검 안내"
            items={maintenanceItems}
          />
        </div>
      </section>

      {/* =========================
          하단: 큰 아르카 시세 박스 + 우측 보조 카드
      ========================= */}
      <section className="mt-8 grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        {/* 큰 박스: 아르카 시세 표 */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-md">
          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-700">Market Overview</p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-900">아르카 시세 표</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                메인에서도 한눈에 흐름을 볼 수 있게 크게 배치한 영역입니다.
                현재 공개 코드 기준으로는 요약 카드 컴포넌트가 이미 있으므로,
                우선은 그 흐름을 중심으로 메인용 표 UI를 안정적으로 확장하는 형태로 구성합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/market-prices"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                시세 탭 이동
              </Link>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="grid grid-cols-[1.1fr_1.4fr_1.2fr] bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-800">
              <div>구분</div>
              <div>내용</div>
              <div>비고</div>
            </div>

            <div className="divide-y divide-zinc-200">
              {marketRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.1fr_1.4fr_1.2fr] px-4 py-4 text-sm"
                >
                  <div className="font-semibold text-zinc-900">{row.label}</div>
                  <div className="text-zinc-700">{row.value}</div>
                  <div className="text-zinc-500">{row.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-600">거래 페이지 방향</p>
              <p className="mt-2 text-lg font-bold text-zinc-900">구매 / 판매 분리</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                비율, 수량, 작성자, 등록일자, 상태를 기준으로 정렬/페이지네이션 확장
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-600">Pro 전용 확장</p>
              <p className="mt-2 text-lg font-bold text-zinc-900">광고 상품 노출</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                상단 광고 슬롯과 개인 저장 시세 기능을 유료 편의 기능으로 연결
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-600">다음 확장</p>
              <p className="mt-2 text-lg font-bold text-zinc-900">시세 통계</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                일간/주간 평균, 체결량, 최고/최저 비율, 최근 체결 로그 추가 가능
              </p>
            </div>
          </div>
        </section>

        {/* 우측 보조 카드 영역 */}
        <div className="grid gap-4">
          <ArcaMarketSummaryCard />

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-zinc-500">서비스 추천 정보</p>
            <h2 className="mt-2 text-xl font-bold text-zinc-900">메인에 같이 넣기 좋은 정보</h2>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">인기 계산기 순위</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  최근 사용량 기준으로 낚시 / 농사 / 요리 진입 빈도를 보여주면
                  첫 화면에서 유저 행동 유도가 쉬워집니다.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">최근 업데이트 한 줄 요약</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  패치노트를 길게 읽지 않아도 핵심 변경점을 즉시 확인할 수 있습니다.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">프로필 연동 상태 안내</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  로그인 / 프로필 연동 / 시세 저장 가능 여부를 배지 형태로 보여주면
                  Free와 Pro 기능 차이도 자연스럽게 안내할 수 있습니다.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}