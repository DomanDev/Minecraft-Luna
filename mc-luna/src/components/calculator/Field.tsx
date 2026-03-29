"use client";

import type { ReactNode } from "react";

/**
 * =========================
 * 라벨 + 입력칸 묶음
 * =========================
 * - 낚시 계산기 입력 행을 공통화
 */
type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
};

export default function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-700">{label}</span>
      {children}
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </label>
  );
}