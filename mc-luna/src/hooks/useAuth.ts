'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * 공통 인증 훅
 *
 * 이 훅의 목적:
 * 1) 현재 로그인 사용자(user)를 안정적으로 반환
 * 2) "로그인 확인 중..." 같은 로딩 UI가 무한히 남지 않도록 보장
 * 3) 탭 이동(pathname 변경) 직후 세션 반영이 늦는 경우도 다시 확인
 *
 * 왜 getUser() 대신 getSession()을 쓰는가?
 * - 현재 프로젝트에서 농사/낚시 계산기 쪽은 getSession() + 재시도 패턴으로
 *   세션 타이밍 문제를 완화하고 있음
 * - 헤더/프로필도 같은 원리로 맞추는 것이 현재 프로젝트 방향과 일치함
 */
export function useAuth() {
  const pathname = usePathname();

  /** 현재 로그인 사용자 */
  const [user, setUser] = useState<User | null>(null);

  /** 인증 확인 중 여부 */
  const [loading, setLoading] = useState(true);

  /**
   * 중복 인증 확인 방지용 ref
   *
   * 이유:
   * - pathname 변경
   * - onAuthStateChange 발생
   * 가 짧은 시간에 겹칠 수 있음
   * - 동시에 여러 번 인증 로직이 돌면 상태가 흔들릴 수 있으므로 방지
   */
  const loadingAuthRef = useRef(false);

  /**
   * 현재 세션에서 user를 안전하게 읽어오는 공통 함수
   *
   * 핵심 정책:
   * - 탭 이동 직후 세션이 늦게 붙는 경우를 고려해 최대 5회 재시도
   * - 200ms 간격으로 짧게 재시도
   * - 실패/예외가 나더라도 finally에서 loading 해제
   */
  const loadAuthUser = useCallback(async () => {
    if (loadingAuthRef.current) return;

    loadingAuthRef.current = true;
    setLoading(true);

    try {
      let resolvedUser: User | null = null;

      for (let i = 0; i < 5; i++) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('useAuth getSession 실패:', error.message);
        }

        if (session?.user) {
          resolvedUser = session.user;
          break;
        }

        // 마지막 시도가 아니면 잠깐 대기 후 재시도
        if (i < 4) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      setUser(resolvedUser);
    } catch (error) {
      console.error('useAuth 인증 확인 중 예외:', error);
      setUser(null);
    } finally {
      setLoading(false);
      loadingAuthRef.current = false;
    }
  }, []);

  /**
   * 1) 최초 진입 시
   * 2) pathname 변경 시
   * 인증을 다시 확인
   *
   * 이유:
   * - App Router 환경에서 페이지 전환은 전체 새로고침이 아니므로
   *   기존 useEffect([]) 1회 구조만으로는 세션 반영 타이밍 이슈가 생길 수 있음
   */
  useEffect(() => {
    loadAuthUser();
  }, [pathname, loadAuthUser]);

  /**
   * 로그인/로그아웃/세션 복원 이벤트 감지
   *
   * 처리 원칙:
   * - 로그아웃 상태면 즉시 user를 null로 두고 loading 종료
   * - 로그인/세션 복원 상태면 즉시 session.user를 반영한 뒤,
   *   필요 시 공통 로더(loadAuthUser)로 한 번 더 안정화
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      // 이벤트로 받은 user를 먼저 반영해서 UI 응답성을 높임
      setUser(session.user);
      setLoading(false);

      // 탭 이동 직후 복원/동기화 타이밍 차이를 줄이기 위해 한 번 더 확인
      void loadAuthUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadAuthUser]);

  return { user, loading };
}