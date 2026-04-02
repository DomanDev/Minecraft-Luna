'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 개발 모드(React Strict Mode)에서 useEffect가 두 번 실행되더라도
   * getUser()를 중복 호출하지 않도록 막는 플래그
   */
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    let mounted = true;

    /**
     * 현재 로그인 사용자 조회
     *
     * 주의:
     * - auth 관련 호출은 동시에 여러 번 겹치면 Web Lock 충돌이 날 수 있음
     * - 그래서 이 훅에서는 최초 1회만 실행되게 제어
     */
    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error('getUser 실패:', error);
        }

        if (mounted) {
          setUser(user ?? null);
        }
      } catch (error) {
        console.error('useAuth getUser 예외:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    /**
     * 로그인 상태 변경 구독
     *
     * 여기서는 추가로 getUser()를 다시 호출하지 않고,
     * 이벤트로 받은 session.user를 그대로 반영하는 쪽이
     * lock 충돌을 줄이는 데 유리함
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}