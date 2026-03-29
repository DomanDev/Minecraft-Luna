"use client";

import type { ReactNode } from "react";

/**
 * =========================
 * 계산기 공통 레이아웃
 * =========================
 * - 낚시 계산기 페이지처럼
 *   상단 제목 + 2열(입력 / 결과) 구조
 * - 테마는 light 고정
 */
type CalculatorLayoutProps = {
  title: string;
  left: ReactNode;
  right: ReactNode;
};

export default function CalculatorLayout({
  title,
  left,
  right,
}: CalculatorLayoutProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {left}
        {right}
      </div>
    </main>
  );
}