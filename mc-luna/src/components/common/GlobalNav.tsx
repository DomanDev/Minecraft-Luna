"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * =========================
 * 공통 네비게이션 바
 * =========================
 * - 좌측: 내부 페이지 이동
 * - 우측: 외부 링크 (루나위키 / 디스코드)
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
            좌측: 내부 페이지 메뉴
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
            우측: 외부 링크
           ========================= */}
        <div className="flex items-center gap-2">
          <a
  href="https://lunawiki.gitbook.io/hello"
  target="_blank"
  rel="noopener noreferrer"
  className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
>
  루나위키 ↗
</a>
          <a
            href="https://discord.com/invite/qqQXz3GteE"
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            디스코드 ↗
          </a>
        </div>
      </div>
    </nav>
  );
}