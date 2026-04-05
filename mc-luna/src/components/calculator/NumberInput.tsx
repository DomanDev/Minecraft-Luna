"use client";

import { useEffect, useState } from "react";

/**
 * =========================
 * 숫자 입력 공통 컴포넌트 (전체 정수 + 콤마 표시)
 * =========================
 *
 * 정책:
 * - 모든 숫자 입력은 정수만 허용
 * - 입력 중에는 빈 문자열("") 허용
 * - 화면에는 천 단위 콤마를 붙여 표시
 *
 * 구현 방식:
 * - input은 text 타입으로 사용
 * - 내부적으로는 숫자만 추출해서 정수로 변환
 * - 부모에는 항상 number로 전달
 *
 * 장점:
 * - 0 완전 삭제 가능
 * - 020 같은 어색한 입력 방지
 * - 10000 -> 10,000 표시 가능
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

/**
 * 숫자를 화면 표시용 문자열로 변환
 * 예: 10000 -> "10,000"
 */
function formatWithCommas(value: number) {
  return value.toLocaleString("ko-KR");
}

/**
 * 사용자가 입력한 문자열에서 숫자만 추출
 *
 * 예:
 * - "10,000" -> "10000"
 * - "abc123" -> "123"
 * - "" -> ""
 */
function extractDigits(value: string) {
  return value.replace(/[^\d]/g, "");
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
   * - 빈값("") 허용
   * - 콤마 표시 유지
   */
  const [displayValue, setDisplayValue] = useState(formatWithCommas(value));

  /**
   * 외부 값 변경 시 표시 문자열 동기화
   *
   * 예:
   * - 전체 초기화
   * - 프로필 자동 불러오기
   * - 추천값 적용
   */
  useEffect(() => {
    setDisplayValue(formatWithCommas(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
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

        /**
         * 숫자 이외 문자는 제거
         */
        const digitsOnly = extractDigits(raw);

        if (digitsOnly === "") {
          setDisplayValue("");
          return;
        }

        const parsed = Number(digitsOnly);

        if (!Number.isFinite(parsed)) return;

        /**
         * 모든 입력은 정수로만 처리
         */
        const normalized = Math.trunc(parsed);
        const clamped = clamp(normalized, min, max);

        /**
         * 화면에는 콤마 적용
         * 부모에는 정수 number 전달
         */
        setDisplayValue(formatWithCommas(clamped));
        onChange(clamped);
      }}
      onBlur={() => {
        /**
         * 빈값이면 fallback 적용
         *
         * 정책:
         * - min 있으면 min
         * - 없으면 0
         */
        if (displayValue === "") {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(Math.trunc(fallback), min, max);

          setDisplayValue(formatWithCommas(clamped));
          onChange(clamped);
          return;
        }

        const digitsOnly = extractDigits(displayValue);

        if (digitsOnly === "") {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(Math.trunc(fallback), min, max);

          setDisplayValue(formatWithCommas(clamped));
          onChange(clamped);
          return;
        }

        const parsed = Number(digitsOnly);

        if (!Number.isFinite(parsed)) {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(Math.trunc(fallback), min, max);

          setDisplayValue(formatWithCommas(clamped));
          onChange(clamped);
          return;
        }

        const clamped = clamp(Math.trunc(parsed), min, max);

        setDisplayValue(formatWithCommas(clamped));
        onChange(clamped);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}