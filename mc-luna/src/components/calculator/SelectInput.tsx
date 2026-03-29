"use client";

/**
 * =========================
 * 드롭다운 공통 컴포넌트
 * =========================
 * - light 테마 고정
 */
type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type SelectInputProps<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
};

export default function SelectInput<T extends string>({
  value,
  options,
  onChange,
}: SelectInputProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}