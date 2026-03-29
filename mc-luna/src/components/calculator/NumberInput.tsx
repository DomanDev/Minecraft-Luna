"use client";

/**
 * =========================
 * 숫자 입력 공통 컴포넌트
 * =========================
 * - NaN 방지
 * - light 테마 고정
 */
type NumberInputProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export default function NumberInput({
  value,
  min,
  max,
  disabled = false,
  onChange,
}: NumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const next = Number(e.target.value);
        onChange(Number.isFinite(next) ? next : 0);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}