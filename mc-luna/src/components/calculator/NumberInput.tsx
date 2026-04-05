"use client";

import { useEffect, useState } from "react";

/**
 * =========================
 * 숫자 입력 공통 컴포넌트 (전체 정수 전용)
 * =========================
 *
 * 정책:
 * - 모든 숫자 입력은 정수만 허용
 * - 소수 입력 시 자동으로 버림(Math.trunc)
 * - 입력창 완전 삭제("") 허용
 *
 * 이유:
 * - 이 프로젝트의 모든 입력값은 사실상 "개수 / 가격 / 레벨" 기반
 * - 소수 입력은 UX적으로 의미 없음
 */

type NumberInputProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function clamp(value: number, min?: number, max?: number) {
  let next = value;

  if (typeof min === "number") {
    next = Math.max(next, min);
  }

  if (typeof max === "number") {
    next = Math.min(next, max);
  }

  return next;
}

export default function NumberInput({
  value,
  min,
  max,
  disabled = false,
  onChange,
}: NumberInputProps) {
  /**
   * input 표시용 문자열 상태
   *
   * 이유:
   * - "" (빈값) 허용
   * - 백스페이스 UX 개선
   */
  const [displayValue, setDisplayValue] = useState(String(value));

  /**
   * 외부 값 변경 시 동기화
   */
  useEffect(() => {
    setDisplayValue(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      step={1}
      value={displayValue}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        /**
         * 완전히 지운 상태 허용
         */
        if (raw === "") {
          setDisplayValue("");
          return;
        }

        const parsed = Number(raw);

        if (!Number.isFinite(parsed)) return;

        /**
         * 🔥 핵심: 무조건 정수화
         */
        const normalized = Math.trunc(parsed);
        const clamped = clamp(normalized, min, max);

        setDisplayValue(String(clamped));
        onChange(clamped);
      }}
      onBlur={() => {
        /**
         * 빈값이면 fallback
         */
        if (displayValue === "") {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(Math.trunc(fallback), min, max);

          setDisplayValue(String(clamped));
          onChange(clamped);
          return;
        }

        const parsed = Number(displayValue);

        if (!Number.isFinite(parsed)) {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(Math.trunc(fallback), min, max);

          setDisplayValue(String(clamped));
          onChange(clamped);
          return;
        }

        const clamped = clamp(Math.trunc(parsed), min, max);

        setDisplayValue(String(clamped));
        onChange(clamped);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}