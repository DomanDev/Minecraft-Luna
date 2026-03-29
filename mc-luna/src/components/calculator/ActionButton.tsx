"use client";

import type { ReactNode } from "react";

/**
 * =========================
 * 공통 버튼
 * =========================
 * - primary: 메인 액션
 * - secondary: 보조 액션
 * - 낚시 계산기의 버튼 배치를 공통화
 */
type ActionButtonProps = {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export default function ActionButton({
  onClick,
  children,
  variant = "primary",
}: ActionButtonProps) {
  const className =
    variant === "primary"
      ? "rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
      : "rounded-xl border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-100";

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
}