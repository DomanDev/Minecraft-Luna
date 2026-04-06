import Link from "next/link";
import ArcaMarketSummaryCard from "@/src/components/market/ArcaMarketSummaryCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">홈</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/fishing-calculator"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-lg font-semibold text-zinc-900">낚시 계산기</div>
          <div className="mt-2 text-sm text-zinc-600">
            낚시 기대 수익 / 시간 / 경험치 계산
          </div>
        </Link>

        <Link
          href="/farming-calculator"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-lg font-semibold text-zinc-900">농사 계산기</div>
          <div className="mt-2 text-sm text-zinc-600">
            작물 등급 확률 / 기대 수익 / 경험치 계산
          </div>
        </Link>

        <Link
          href="/cooking-calculator"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-lg font-semibold text-zinc-900">요리 계산기</div>
          <div className="mt-2 text-sm text-zinc-600">
            일반/일품 확률, 재료 원가, 기대 순이익 계산
          </div>
        </Link>

        <Link
          href="/profile"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-lg font-semibold text-zinc-900">프로필</div>
          <div className="mt-2 text-sm text-zinc-600">
            생활 정보 불러오기 / 직접 입력 / 스탯 저장
          </div>
        </Link>

        <ArcaMarketSummaryCard />
      </div>
    </main>
  );
}