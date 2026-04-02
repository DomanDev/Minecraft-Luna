"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
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
 *
 * 중요:
 * - 아래 JSX / className은 사용자가 첨부한 "원래 디자인"을 그대로 유지한다.
 * - 이번 수정은 UI 변경이 아니라 인증 로딩 안정화만 목적이다.
 */
type HeaderProfile = {
  username: string | null;
  display_name: string | null;
};

export default function GlobalHeader() {
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);

  /**
   * 중복 로딩 방지용 ref
   *
   * pathname 변경 + auth state 변경이 짧은 시간에 연속 발생할 수 있어서
   * 동시에 여러 번 불러오는 일을 줄이기 위해 사용한다.
   */
  const loadingHeaderRef = useRef(false);

  /**
   * 로그인한 사용자의 profiles 표시 정보 조회
   */
  const fetchProfile = useCallback(async (user: User) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    if (error) {
      console.warn("헤더 profiles 조회 실패:", error.message);
      return {
        username: null,
        display_name: null,
      };
    }

    return {
      username: data?.username ?? null,
      display_name: data?.display_name ?? null,
    };
  }, []);

  /**
   * 헤더 사용자 정보 로딩
   *
   * 왜 getSession 재시도를 쓰는가?
   * - 기존 코드는 useEffect([]) + getUser() 1회 확인 구조라서
   *   탭 이동 직후 세션 복원 타이밍이 늦으면 헤더가 정상 반영되지 않을 수 있다.
   * - 그래서 현재 프로젝트의 계산기 페이지에서 쓰는 방식처럼
   *   짧게 여러 번 재시도해서 세션이 늦게 붙는 상황을 완화한다.
   *
   * UI는 절대 바꾸지 않고 상태만 안정적으로 갱신한다.
   */
  const loadHeaderUser = useCallback(async () => {
    if (loadingHeaderRef.current) return;

    loadingHeaderRef.current = true;
    setLoading(true);

    try {
      let resolvedUser: User | null = null;

      /**
       * 최대 5회 재시도
       * - 탭 이동 직후 세션이 아직 준비되지 않은 경우를 대비
       * - 200ms 간격으로 짧게 확인
       */
      for (let i = 0; i < 5; i++) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn("헤더 getSession 실패:", error.message);
        }

        if (session?.user) {
          resolvedUser = session.user;
          break;
        }

        if (i < 4) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      /**
       * 로그인 사용자가 없는 경우
       * - 로그인 버튼 상태로 돌리고 로딩 종료
       */
      if (!resolvedUser) {
        setUserEmail(null);
        setProfile(null);
        return;
      }

      setUserEmail(resolvedUser.email ?? null);

      const nextProfile = await fetchProfile(resolvedUser);
      setProfile(nextProfile);
    } catch (error) {
      console.error("헤더 사용자 로딩 중 예외:", error);

      /**
       * 예외가 나더라도 로딩이 영원히 멈추지 않게
       * 기본 비로그인 상태로 정리
       */
      setUserEmail(null);
      setProfile(null);
    } finally {
      setLoading(false);
      loadingHeaderRef.current = false;
    }
  }, [fetchProfile]);

  /**
   * 최초 진입 + pathname 변경 시 재확인
   *
   * 기존 문제:
   * - useEffect([]) 1회만 실행되면 탭 이동 후 세션 반영이 늦을 때
   *   헤더 닉네임이 "불러오는 중..."에 머무를 수 있음
   *
   * 개선:
   * - 경로가 바뀔 때마다 다시 확인
   */
  useEffect(() => {
    void loadHeaderUser();
  }, [pathname, loadHeaderUser]);

  /**
   * 인증 상태 변화 구독
   *
   * 로그인 / 로그아웃 / 세션 복원 이벤트가 발생하면
   * 헤더를 다시 동기화한다.
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      /**
       * 로그아웃 또는 세션 없음
       */
      if (!currentUser) {
        setUserEmail(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      /**
       * 이벤트에서 받은 이메일은 먼저 반영하고,
       * profiles 포함한 최종 상태는 공통 로더로 다시 맞춘다.
       */
      setUserEmail(currentUser.email ?? null);
      setLoading(false);

      void loadHeaderUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadHeaderUser]);

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