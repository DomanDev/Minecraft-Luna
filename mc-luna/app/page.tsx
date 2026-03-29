// app/page.tsx

import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="mb-6 text-3xl font-bold">루나 서버 계산기 홈</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* =========================
            기존 낚시 계산기
           ========================= */}
        <Link
          href="/calculator"
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 hover:bg-zinc-800"
        >
          <h2 className="text-xl font-semibold">낚시 계산기</h2>
          <p className="mt-2 text-sm text-zinc-400">
            낚시 기대 수익, 기대 경험치 계산
          </p>
        </Link>

        {/* =========================
            🔥 추가: 농사 계산기
           ========================= */}
        <Link
          href="/farming-calculator"
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 hover:bg-zinc-800"
        >
          <h2 className="text-xl font-semibold">농사 계산기</h2>
          <p className="mt-2 text-sm text-zinc-400">
            농사 결과물 기대값, 수익, 경험치 계산
          </p>
        </Link>

        {/* =========================
            프로필 페이지
           ========================= */}
        <Link
          href="/profile"
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 hover:bg-zinc-800"
        >
          <h2 className="text-xl font-semibold">프로필</h2>
          <p className="mt-2 text-sm text-zinc-400">
            생활 정보 입력 및 프로필 관리
          </p>
        </Link>

        {/* =========================
            로그인 페이지
           ========================= */}
        <Link
          href="/login"
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 hover:bg-zinc-800"
        >
          <h2 className="text-xl font-semibold">로그인</h2>
          <p className="mt-2 text-sm text-zinc-400">
            로그인 페이지로 이동
          </p>
        </Link>
      </div>
    </main>
  );
}