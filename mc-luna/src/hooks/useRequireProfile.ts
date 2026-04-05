'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

/**
 * 접근 제어용 프로필 가드 훅
 *
 * 목적:
 * 1) 로그인하지 않은 사용자는 /login 으로 이동
 * 2) 로그인은 했지만 마인크래프트 프로필 연동이 끝나지 않은 사용자는 /profile 로 이동
 * 3) 리다이렉트 전에 토스트 메시지를 띄워 사용자가 왜 이동되는지 알 수 있게 함
 *
 * 왜 별도 훅으로 분리하는가?
 * - 현재 낚시/농사/요리 계산기는 각각 자체 프로필 로딩 로직을 가지고 있음
 * - 계산기 내부 로직을 크게 건드리지 않고, "페이지 진입 가능 여부"만 공통화하는 편이 안전함
 * - 이후 mining 계산기나 다른 보호 페이지에도 그대로 재사용 가능
 */

/**
 * profiles 테이블에서 최소한으로 확인할 필드 타입
 *
 * 핵심 체크 기준:
 * - minecraft_link_status === 'verified'
 * - minecraft_uuid 존재
 *
 * 참고:
 * linked 상태만으로 충분히 볼 수도 있지만,
 * 현재 네 프로젝트 설명 기준으로는 "프로필 연동 완료"를 좀 더 명확히 보려면
 * verified + uuid 존재를 함께 보는 쪽이 안전하다.
 */
type GuardProfileRow = {
  minecraft_uuid: string | null;
  minecraft_link_status: 'needs_lookup' | 'linked' | 'verified' | null;
};

type UseRequireProfileOptions = {
  /**
   * 로그인 안 된 경우 이동할 경로
   * 기본값: /login
   */
  loginRedirectTo?: string;

  /**
   * 프로필 연동이 안 된 경우 이동할 경로
   * 기본값: /profile
   */
  profileRedirectTo?: string;

  /**
   * 로그인 필요 시 보여줄 메시지
   */
  loginMessage?: string;

  /**
   * 프로필 연동 필요 시 보여줄 메시지
   */
  profileMessage?: string;

  /**
   * verified 가 아니어도 linked 까지만 허용할지 여부
   * 현재 기본값은 false = verified만 허용
   */
  allowLinkedWithoutVerified?: boolean;
};

export function useRequireProfile(options?: UseRequireProfileOptions) {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * 기존 공통 인증 훅 사용
   * - user: 현재 로그인 사용자
   * - loading: 인증 확인 중 여부
   */
  const { user, loading } = useAuth();

  /**
   * 이 훅 자체의 프로필 검사 로딩 상태
   *
   * 의미:
   * - useAuth의 loading이 끝났더라도
   * - profiles 테이블을 추가 조회하는 동안은 아직 "가드 판정 중" 상태임
   */
  const [checking, setChecking] = useState(true);

  /**
   * 현재 페이지 접근 허용 여부
   * true가 되어야 페이지 본문을 보여주는 것을 권장
   */
  const [allowed, setAllowed] = useState(false);

  /**
   * 같은 페이지 진입 중 중복 토스트/중복 replace 방지
   *
   * 이유:
   * - App Router + auth state change + pathname 변경 타이밍이 겹치면
   *   짧은 시간에 여러 번 같은 리다이렉트 로직이 돌 수 있음
   * - 사용자 입장에서 토스트가 여러 번 뜨거나 replace가 연속 호출되면 UX가 지저분해짐
   */
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const guard = async () => {
      /**
       * 1단계: 인증 확인이 끝나기 전에는 판정 보류
       */
      if (loading) {
        setChecking(true);
        setAllowed(false);
        return;
      }

      /**
       * 2단계: 로그인 안 된 경우
       */
      if (!user) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;

          toast.error(
            options?.loginMessage ?? '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
          );

          /**
           * 현재 보던 페이지를 나중에 다시 돌아올 수 있도록 next 파라미터로 전달
           */
          const next = encodeURIComponent(pathname || '/');
          router.replace(`${options?.loginRedirectTo ?? '/login'}?next=${next}`);
        }

        if (!cancelled) {
          setChecking(false);
          setAllowed(false);
        }
        return;
      }

      /**
       * 3단계: profiles 테이블에서 연동 상태 확인
       */
      try {
        setChecking(true);

        const { data, error } = await supabase
          .from('profiles')
          .select('minecraft_uuid, minecraft_link_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('useRequireProfile profiles 조회 실패:', error.message);

          /**
           * profiles 조회에 실패한 경우도 안전하게 /profile 로 유도
           *
           * 이유:
           * - row 미생성 / RLS / 일시적 조회 실패 등 다양한 가능성이 있음
           * - 계산기 진입을 허용해버리면 뒤쪽 페이지 로직에서 더 애매하게 깨질 수 있음
           */
          if (!redirectingRef.current) {
            redirectingRef.current = true;

            toast.error(
              options?.profileMessage ??
                '프로필 정보를 확인할 수 없습니다. 프로필 페이지에서 다시 연동해 주세요.',
            );

            router.replace(options?.profileRedirectTo ?? '/profile');
          }

          if (!cancelled) {
            setAllowed(false);
            setChecking(false);
          }
          return;
        }

        const profile = data as GuardProfileRow | null;

        const hasUuid = Boolean(profile?.minecraft_uuid);

        /**
         * 허용 기준:
         * - 기본: verified + uuid 존재
         * - 옵션 허용 시: linked 또는 verified + uuid 존재
         */
        const isLinkedEnough = options?.allowLinkedWithoutVerified == false
          ? profile?.minecraft_link_status === 'verified' 
          : profile?.minecraft_link_status === 'linked' || 
            profile?.minecraft_link_status === 'verified';

        const canAccess = hasUuid && isLinkedEnough;

        if (!canAccess) {
          if (!redirectingRef.current) {
            redirectingRef.current = true;

            toast.error(
              options?.profileMessage ??
                '마인크래프트 프로필 연동이 필요합니다. 프로필 페이지로 이동합니다.',
            );

            router.replace(options?.profileRedirectTo ?? '/profile');
          }

          if (!cancelled) {
            setAllowed(false);
            setChecking(false);
          }
          return;
        }

        /**
         * 여기까지 왔으면 접근 허용
         */
        if (!cancelled) {
          redirectingRef.current = false;
          setAllowed(true);
          setChecking(false);
        }
      } catch (error) {
        console.error('useRequireProfile 검사 중 예외:', error);

        if (!redirectingRef.current) {
          redirectingRef.current = true;

          toast.error(
            options?.profileMessage ??
              '프로필 확인 중 문제가 발생했습니다. 프로필 페이지로 이동합니다.',
          );

          router.replace(options?.profileRedirectTo ?? '/profile');
        }

        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
      }
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    user,
    router,
    pathname,
    options?.loginRedirectTo,
    options?.profileRedirectTo,
    options?.loginMessage,
    options?.profileMessage,
    options?.allowLinkedWithoutVerified,
  ]);

  return {
    /**
     * 전체 가드 확인 중 여부
     * - true면 "접근 확인 중..." 같은 대기 UI를 보여주면 됨
     */
    loading: loading || checking,

    /**
     * 접근 허용 여부
     */
    allowed,
  };
}