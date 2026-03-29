"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import ThemeToggleButton from "@/src/components/common/ThemeToggleButton";
import GlobalNav from "@/src/components/common/GlobalNav";

/**
 * =========================
 * 공통 상단 헤더
 * =========================
 * 구조:
 * - 1줄: 좌측 도맨 얼굴 + 텍스트 / 중앙 루나 로고 + 제목 / 우측 테마 + 닉네임 + 로그인/로그아웃
 * - 2줄: 공통 네비게이션 바
 */
type HeaderProfile = {
  username: string | null;
  display_name: string | null;
};

export default function GlobalHeader() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHeaderUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!user) {
        setUserEmail(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;

      setProfile({
        username: data?.username ?? null,
        display_name: data?.display_name ?? null,
      });

      setLoading(false);
    };

    loadHeaderUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      const currentUser = session?.user ?? null;

      if (!currentUser) {
        setUserEmail(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUserEmail(currentUser.email ?? null);

      const { data } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", currentUser.id)
        .single();

      if (!isMounted) return;

      setProfile({
        username: data?.username ?? null,
        display_name: data?.display_name ?? null,
      });

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const headerName =
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    userEmail ||
    "사용자";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      {/* =========================
          1줄 헤더 본문
         ========================= */}
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3">
        {/* =========================
            좌측: 도맨 얼굴 + 텍스트
           ========================= */}
        <div className="flex items-center justify-start">
          <Link href="/" className="flex items-center gap-3">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <Image
                src="/branding/plbear-face.png"
                alt="도맨 캐릭터 얼굴"
                width={44}
                height={44}
                priority
                className="h-11 w-11 object-cover"
              />
            </div>

            <div className="leading-tight">
              <div className="text-base font-bold text-zinc-900">Doman</div>
              <div className="text-xs text-zinc-500">made by 도맨</div>
            </div>
          </Link>
        </div>

        {/* =========================
            중앙: 루나 로고 + 제목
           ========================= */}
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/branding/luna-logo.png"
            alt="루나 로고"
            width={44}
            height={44}
            priority
            className="h-11 w-auto object-contain"
          />

          <Link
            href="/"
            className="whitespace-nowrap text-lg font-bold text-zinc-900 sm:text-xl"
          >
            루나월드 통합 어플리케이션
          </Link>
        </div>

        {/* =========================
            우측: 테마 + 닉네임 + 로그인/로그아웃
           ========================= */}
        <div className="flex items-center justify-end gap-2">
          <ThemeToggleButton />

          {loading ? (
            <div className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-500 shadow-sm">
              불러오는 중...
            </div>
          ) : userEmail ? (
            <>
              <Link
                href="/profile"
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100"
              >
                {headerName}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {/* =========================
          2줄: 공통 네비게이션 바
         ========================= */}
      <GlobalNav />
    </header>
  );
}