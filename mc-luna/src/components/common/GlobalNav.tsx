"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * =========================
 * 공통 네비게이션 바 (최종)
 * =========================
 * - 좌측: 내부 페이지 이동
 * - 우측: 외부 링크 + 아이콘
 */
const navItems = [
  { href: "/", label: "홈" },
  { href: "/calculator", label: "낚시" },
  { href: "/farming-calculator", label: "농사" },
  { href: "/mining-calculator", label: "채광" },
  { href: "/cooking-calculator", label: "요리" },
];

export default function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-zinc-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        
        {/* =========================
            좌측: 내부 메뉴
           ========================= */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* =========================
            우측: 외부 링크 (아이콘 포함)
           ========================= */}
        <div className="flex items-center gap-2">

          {/* 루나위키 */}
          <a
            href="https://lunawiki.gitbook.io/hello"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-orange-300 bg-gradient-to-r from-yellow-50 to-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:from-yellow-100 hover:to-orange-100"
          >
            

            🌙루나위키 ↗
          </a>

          {/* 디스코드 */}
          <a
            href="https://discord.com/invite/qqQXz3GteE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            {/* 🎮 디스코드 아이콘 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M20.317 4.3698C18.545 3.545 16.633 3 14.652 2.75C14.39 3.227 14.087 3.872 13.87 4.38C11.897 4.083 9.937 4.083 8.001 4.38C7.784 3.872 7.473 3.227 7.21 2.75C5.228 3 3.316 3.545 1.545 4.3698C-1.09 8.299 -1.823 12.127 -1.458 15.9C0.235 17.205 2.028 18.23 3.9 18.9C4.349 18.27 4.756 17.602 5.104 16.9C4.432 16.65 3.795 16.34 3.19 15.97C3.35 15.86 3.505 15.745 3.655 15.625C7.1 17.2 10.83 17.2 14.23 15.625C14.38 15.745 14.535 15.86 14.695 15.97C14.09 16.34 13.453 16.65 12.78 16.9C13.128 17.602 13.535 18.27 13.984 18.9C15.856 18.23 17.65 17.205 19.342 15.9C19.783 11.514 18.664 7.72 16.317 4.3698ZM8.68 13.2C7.64 13.2 6.79 12.26 6.79 11.1C6.79 9.94 7.62 9 8.68 9C9.74 9 10.6 9.94 10.58 11.1C10.58 12.26 9.74 13.2 8.68 13.2ZM14.64 13.2C13.6 13.2 12.75 12.26 12.75 11.1C12.75 9.94 13.58 9 14.64 9C15.7 9 16.56 9.94 16.54 11.1C16.54 12.26 15.7 13.2 14.64 13.2Z" />
            </svg>

            디스코드 ↗
          </a>
        </div>
      </div>
    </nav>
  );
}