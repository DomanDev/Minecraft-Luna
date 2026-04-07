"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * =========================
 * 스탯 입력 전용 공통 컴포넌트
 * (소수점 허용 + 천 단위 콤마 표시)
 * =========================
 *
 * 사용 목적:
 * - 행운 / 감각 / 인내력 같은 스탯 입력
 * - 111.38 같은 소수 입력 유지
 * - 1000 이상이면 1,000 / 1,111.38 형태로 표시
 *
 * 기존 NumberInput 과의 차이:
 * - NumberInput: 정수 전용
 * - StatNumberInput: 소수 허용
 */

type StatNumberInputProps = {
  value: number;
  min?: number;
  max?: number;
  step?: string;
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
 * step 값으로 허용 소수 자릿수 계산
 * 예:
 * - "1"   -> 0
 * - "0.1" -> 1
 * - "0.01" -> 2
 */
function getPrecision(step?: string) {
  if (!step || !step.includes(".")) return 0;
  return step.split(".")[1]?.length ?? 0;
}

/**
 * 사용자가 입력한 문자열에서
 * 숫자 + 소수점 1개만 허용
 *
 * 예:
 * - "111.38" -> "111.38"
 * - "1,111.38" -> "1111.38"
 * - "abc12.3d4" -> "12.34"
 * - "..1.2" -> ".12"
 */
function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");

  const firstDotIndex = cleaned.indexOf(".");
  if (firstDotIndex === -1) {
    return cleaned;
  }

  const integerPart = cleaned.slice(0, firstDotIndex);
  const fractionalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");

  return `${integerPart}.${fractionalPart}`;
}

/**
 * 정수부에만 콤마를 붙이고
 * 소수부는 그대로 유지
 *
 * 예:
 * - "1111" -> "1,111"
 * - "1111.38" -> "1,111.38"
 * - "1111." -> "1,111."
 * - ".5" -> "0.5"
 */
function formatDecimalDisplay(raw: string) {
  if (raw === "") return "";
  if (raw === ".") return "0.";

  const hasDot = raw.includes(".");
  const [integerPartRaw, fractionalPartRaw = ""] = raw.split(".");

  const safeIntegerPart =
    integerPartRaw === "" ? "0" : String(Number(integerPartRaw));

  const integerWithCommas = Number(safeIntegerPart).toLocaleString("ko-KR");

  if (!hasDot) {
    return integerWithCommas;
  }

  return `${integerWithCommas}.${fractionalPartRaw}`;
}

/**
 * 외부 number 값을 화면용 문자열로 변환
 */
function formatNumberForDisplay(value: number, precision: number) {
  if (!Number.isFinite(value)) return "0";

  if (precision <= 0) {
    return Math.trunc(value).toLocaleString("ko-KR");
  }

  const fixed = value.toFixed(precision);
  const [integerPart, fractionalPart] = fixed.split(".");

  const formattedInteger = Number(integerPart).toLocaleString("ko-KR");

  // 뒤쪽 불필요한 0 제거
  const trimmedFraction = fractionalPart.replace(/0+$/, "");

  return trimmedFraction
    ? `${formattedInteger}.${trimmedFraction}`
    : formattedInteger;
}

export default function StatNumberInput({
  value,
  min,
  max,
  step = "0.1",
  disabled = false,
  onChange,
}: StatNumberInputProps) {
  const precision = useMemo(() => getPrecision(step), [step]);

  /**
   * input 표시용 문자열 상태
   *
   * 이유:
   * - "111."
   * - ".5"
   * - 빈 문자열("")
   * 같은 입력 중간 상태를 자연스럽게 허용하기 위해
   */
  const [displayValue, setDisplayValue] = useState(
    formatNumberForDisplay(value, precision),
  );

  /**
   * 외부 값이 바뀌면 표시값 동기화
   *
   * 예:
   * - 프로필 자동 불러오기
   * - 전체 초기화
   * - 저장 후 재렌더
   */
  useEffect(() => {
    setDisplayValue(formatNumberForDisplay(value, precision));
  }, [value, precision]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        /**
         * 완전 삭제 허용
         */
        if (raw === "") {
          setDisplayValue("");
          return;
        }

        const sanitized = sanitizeDecimalInput(raw);

        /**
         * "." 하나만 남은 상태도 허용
         * 사용자가 이제 막 소수점을 입력한 중간 상태일 수 있음
         */
        if (sanitized === "") {
          setDisplayValue("");
          return;
        }

        if (sanitized === ".") {
          setDisplayValue("0.");
          return;
        }

        setDisplayValue(formatDecimalDisplay(sanitized));

        const parsed = Number(sanitized);
        if (!Number.isFinite(parsed)) return;

        const clamped = clamp(parsed, min, max);
        onChange(clamped);
      }}
      onBlur={() => {
        /**
         * blur 시점에는 실제 number 로 정규화해서
         * 화면 표시도 안정적으로 맞춘다.
         */
        const sanitized = sanitizeDecimalInput(displayValue);

        if (sanitized === "" || sanitized === ".") {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(fallback, min, max);
          setDisplayValue(formatNumberForDisplay(clamped, precision));
          onChange(clamped);
          return;
        }

        let parsed = Number(sanitized);
        if (!Number.isFinite(parsed)) {
          const fallback = typeof min === "number" ? min : 0;
          const clamped = clamp(fallback, min, max);
          setDisplayValue(formatNumberForDisplay(clamped, precision));
          onChange(clamped);
          return;
        }

        parsed = clamp(parsed, min, max);

        /**
         * step 기준 소수 자릿수 보정
         * 예: step="0.1" 이면 1자리까지
         */
        const normalized =
          precision > 0 ? Number(parsed.toFixed(precision)) : Math.trunc(parsed);

        setDisplayValue(formatNumberForDisplay(normalized, precision));
        onChange(normalized);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}