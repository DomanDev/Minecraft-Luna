"use client";

import type { ReactNode } from "react";

/**
 * =========================
 * 계산기 공통 패널
 * =========================
 * - 낚시 계산기의 좌/우 영역과 같은 용도
 * - light 카드 스타일 고정
 */
type CalculatorPanelProps = {
  title: string;
  children: ReactNode;
};

export default function CalculatorPanel({
  title,
  children,
}: CalculatorPanelProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}