"use client";

import type { ReactNode } from "react";

/**
 * =========================
 * 결과 카드 공통 컴포넌트
 * =========================
 * - 낚시 계산기의 결과 카드처럼
 *   제목 + 내용 블록 구조
 * - light 테마 고정
 */
type ResultCardProps = {
  title: string;
  children: ReactNode;
};

export default function ResultCard({ title, children }: ResultCardProps) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="mb-3 text-lg font-semibold text-zinc-900">{title}</h3>
      <div className="space-y-2 text-sm text-zinc-800">{children}</div>
    </div>
  );
}