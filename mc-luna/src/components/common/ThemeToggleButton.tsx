"use client";

import { useEffect, useState } from "react";

/**
 * =========================
 * 공통 테마 토글 버튼
 * =========================
 * - 현재 기본값은 light
 * - 나중에 전체 다크 테마 확장용 기반
 * - 지금은 헤더/전역 배경 변수부터 반영됨
 */
type ThemeMode = "light" | "dark";

export default function ThemeToggleButton() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme") as ThemeMode | null;
    const nextTheme: ThemeMode = saved === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="테마 변경"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm"
      >
        ☀️
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="테마 변경"
      title={theme === "light" ? "다크 모드로 변경" : "라이트 모드로 변경"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-100"
    >
      <span className="text-lg">{theme === "light" ? "☀️" : "🌙"}</span>
    </button>
  );
}