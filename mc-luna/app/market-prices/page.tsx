'use client';

/**
 * =========================
 * 시세 페이지 (market-prices)
 * =========================
 *
 * 이번 수정 목표:
 * 1) 공통 CalculatorLayout / NumberInput / 우측 안내 패널에 영향 주지 않기
 * 2) 시세 탭만 단독 레이아웃으로 구성
 * 3) 화면 전체 폭을 시세 입력 영역으로 사용
 * 4) 입력칸 숫자는 시세 탭에서만 오른쪽 정렬
 * 5) 각 입력칸 오른쪽에 "셀" 표기 추가
 *
 * 주의:
 * - 공통 NumberInput은 수정하지 않는다.
 * - 이 페이지에서만 일반 <input type="text"> 기반의 전용 입력 UI를 사용한다.
 * - 입력값은 정수만 허용하고, 화면에는 천 단위 콤마를 표시한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';

import ActionButton from '@/src/components/calculator/ActionButton';
import { useRequireProfile } from '@/src/hooks/useRequireProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { supabase } from '@/src/lib/supabase';

import { loadUserMarketPrices, upsertUserMarketPrices } from '@/src/lib/market/db';
import { mergeUserPrices } from '@/src/lib/market/merge';
import { FARMING_MARKET_ITEMS } from '@/src/lib/market/defaultPrices';

import type {
  MarketCategory,
  MarketGrade,
  MarketPriceItem,
  UserMarketPriceRow,
} from '@/src/lib/market/types';

/**
 * 현재는 농사 탭만 먼저 연결
 *
 * 이후 확장:
 * - fishing
 * - enhancement
 * - cooking
 * - mining
 *
 * defaultPrices.ts에 각 탭 배열이 준비되면
 * 같은 구조로 TAB_DEFINITIONS에 추가하면 된다.
 */
type MarketTabKey = 'farming';

const TAB_DEFINITIONS: {
  key: MarketTabKey;
  label: string;
  category: MarketCategory;
  items: MarketPriceItem[];
}[] = [
  {
    key: 'farming',
    label: '농사',
    category: 'farming',
    items: FARMING_MARKET_ITEMS,
  },
];

/**
 * 편집 상태 key 생성
 *
 * 예:
 * - cabbage:normal
 * - cabbage:advanced
 * - cabbage:rare
 */
function buildEditKey(itemKey: string, grade: string) {
  return `${itemKey}:${grade}`;
}

/**
 * 화면 표시용 콤마 포맷
 *
 * 예:
 * 10000 -> "10,000"
 */
function formatWithCommas(value: number) {
  return value.toLocaleString('ko-KR');
}

/**
 * 입력 문자열에서 숫자만 추출
 *
 * 예:
 * "10,000" -> "10000"
 * "abc123" -> "123"
 */
function extractDigits(value: string) {
  return value.replace(/[^\d]/g, '');
}

/**
 * =========================
 * 시세 탭 전용 숫자 입력 컴포넌트
 * =========================
 *
 * 이유:
 * - 공통 NumberInput을 수정하면 다른 계산기 페이지에도 영향이 감
 * - 사용자는 시세 탭에서만
 *   1) 오른쪽 정렬
 *   2) 셀 텍스트 표시
 * 를 원함
 *
 * 따라서 이 페이지 내부 전용 컴포넌트로 분리한다.
 */
function MarketPriceInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  /**
   * 입력창에는 문자열 형태로 값을 들고 있어야
   * - 빈값 허용
   * - 콤마 유지
   * 가 가능하다.
   */
  const [displayValue, setDisplayValue] = useState(formatWithCommas(value));

  /**
   * 외부 값이 바뀌면 입력창 표시값도 동기화
   *
   * 예:
   * - DB 로딩 후 초기값 반영
   * - 탭 변경
   * - 저장 후 재로딩
   */
  useEffect(() => {
    setDisplayValue(formatWithCommas(value));
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;

          /**
           * 전체 삭제는 허용
           * 단, blur 시 다시 0 또는 유효값으로 보정한다.
           */
          if (raw === '') {
            setDisplayValue('');
            return;
          }

          const digitsOnly = extractDigits(raw);

          if (digitsOnly === '') {
            setDisplayValue('');
            return;
          }

          const parsed = Number(digitsOnly);

          if (!Number.isFinite(parsed)) return;

          const normalized = Math.max(0, Math.trunc(parsed));

          setDisplayValue(formatWithCommas(normalized));
          onChange(normalized);
        }}
        onBlur={() => {
          /**
           * 빈값으로 포커스 아웃되면 0으로 보정
           */
          if (displayValue === '') {
            setDisplayValue('0');
            onChange(0);
            return;
          }

          const digitsOnly = extractDigits(displayValue);

          if (digitsOnly === '') {
            setDisplayValue('0');
            onChange(0);
            return;
          }

          const parsed = Number(digitsOnly);

          if (!Number.isFinite(parsed)) {
            setDisplayValue('0');
            onChange(0);
            return;
          }

          const normalized = Math.max(0, Math.trunc(parsed));

          setDisplayValue(formatWithCommas(normalized));
          onChange(normalized);
        }}
        className={[
          'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2',
          /**
           * 시세 탭 전용 요구사항:
           * - 숫자 오른쪽 정렬
           */
          'text-right text-zinc-900 outline-none',
          'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
          'disabled:bg-zinc-100 disabled:text-zinc-500',
        ].join(' ')}
      />

      {/**
       * 시세 탭 전용 요구사항:
       * - 입력칸 오른쪽에 "셀" 표기
       */}
      <span className="shrink-0 text-sm text-zinc-500">셀</span>
    </div>
  );
}

export default function MarketPricesPage() {
  /**
   * =========================
   * 1) 접근 가드
   * =========================
   *
   * 로그인/프로필 연동 여부만 판단
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: '시세 탭을 사용하려면 로그인이 필요합니다.',
    profileMessage: '시세 탭을 사용하려면 마인크래프트 프로필 연동이 필요합니다.',
  });

  /**
   * =========================
   * 2) 실제 로그인 사용자
   * =========================
   *
   * user.id가 있어야
   * - profiles.plan_type 조회
   * - user_market_prices 조회/저장
   * 가 가능하다.
   */
  const { user, loading: authLoading } = useAuth();

  /**
   * =========================
   * 3) 페이지 상태
   * =========================
   */
  const [activeTab, setActiveTab] = useState<MarketTabKey>('farming');
  const [planType, setPlanType] = useState<'free' | 'pro'>('free');
  const [items, setItems] = useState<MarketPriceItem[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * 중복 로딩 방지
   */
  const loadingRef = useRef(false);

  /**
   * 현재 활성 탭 메타 정보
   */
  const activeTabMeta = useMemo(
    () => TAB_DEFINITIONS.find((tab) => tab.key === activeTab) ?? TAB_DEFINITIONS[0],
    [activeTab],
  );

  /**
   * free / pro 정책
   * - free: 읽기 전용
   * - pro: 수정 및 저장 가능
   */
  const isProUser = planType === 'pro';

  /**
   * =========================
   * 4) 페이지 데이터 로드
   * =========================
   *
   * 순서:
   * 1. profiles에서 plan_type 조회
   * 2. user_market_prices 조회
   * 3. 기본값과 merge
   * 4. 편집 상태 초기화
   */
  const loadPageData = useCallback(async () => {
    if (guardLoading) return;
    if (!allowed) return;
    if (authLoading) return;
    if (!user) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    setPageLoading(true);

    try {
      /**
       * 4-1) 현재 사용자 플랜 조회
       */
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.warn('market-prices profiles 조회 실패:', profileError.message);
        setPlanType('free');
      } else {
        setPlanType((profileRow?.plan_type ?? 'free') as 'free' | 'pro');
      }

      /**
       * 4-2) 유저 저장 시세 조회
       */
      const userRows = await loadUserMarketPrices(user.id, activeTabMeta.category);

      /**
       * 4-3) 기본값 + 저장값 merge
       */
      const mergedItems = mergeUserPrices(activeTabMeta.items, userRows);

      setItems(mergedItems);

      /**
       * 4-4) 편집 상태 초기화
       */
      const nextEditedPrices: Record<string, number> = {};

      mergedItems.forEach((item) => {
        Object.entries(item.prices).forEach(([grade, price]) => {
          nextEditedPrices[buildEditKey(item.key, grade)] = Number(price ?? 0);
        });
      });

      setEditedPrices(nextEditedPrices);
    } catch (error) {
      console.error('market-prices 데이터 로딩 중 예외:', error);
      toast.error('시세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      loadingRef.current = false;
      setPageLoading(false);
    }
  }, [activeTabMeta, allowed, authLoading, guardLoading, user]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  /**
   * =========================
   * 5) 가격 입력 변경
   * =========================
   */
  const handleChangePrice = (
    itemKey: string,
    grade: MarketGrade,
    nextValue: number,
  ) => {
    const editKey = buildEditKey(itemKey, grade);

    setEditedPrices((prev) => ({
      ...prev,
      [editKey]: nextValue,
    }));
  };

  /**
   * =========================
   * 6) 현재 탭 저장
   * =========================
   */
  const handleSavePrices = async () => {
    if (!user) {
      toast.error('사용자 정보를 확인할 수 없습니다.');
      return;
    }

    if (!isProUser) {
      toast.error('시세 저장은 Pro 사용자만 가능합니다.');
      return;
    }

    try {
      setSaving(true);

      const rows: UserMarketPriceRow[] = [];

      items.forEach((item) => {
        Object.keys(item.prices).forEach((grade) => {
          const typedGrade = grade as MarketGrade;
          const price = editedPrices[buildEditKey(item.key, typedGrade)] ?? 0;

          rows.push({
            user_id: user.id,
            category: item.category,
            item_key: item.key,
            grade: typedGrade,
            price,
          });
        });
      });

      await upsertUserMarketPrices(rows);

      toast.success('시세가 저장되었습니다.');

      /**
       * 저장 후 다시 로드해서
       * 실제 DB 반영 상태와 화면을 맞춘다.
       */
      await loadPageData();
    } catch (error) {
      console.error('market-prices 저장 중 예외:', error);
      toast.error('시세 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * =========================
   * 7) 로딩 / 접근 상태
   * =========================
   */
  if (guardLoading || authLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
        <h1 className="mb-6 text-3xl font-bold">시세 탭</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          시세 탭 접근 상태를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
        <h1 className="mb-6 text-3xl font-bold">시세 탭</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          접근 권한을 확인하는 중입니다.
        </div>
      </main>
    );
  }

  if (pageLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
        <h1 className="mb-6 text-3xl font-bold">시세 탭</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          시세 데이터를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  /**
   * =========================
   * 8) 최종 렌더
   * =========================
   *
   * 시세 탭은 우측 패널 없이
   * 한 페이지 전체를 시세 입력용으로 사용한다.
   */
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-zinc-900">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">시세 탭</h1>
          <p className="mt-2 text-sm text-zinc-600">
            기본 시세를 확인하고, Pro 사용자는 개인 시세를 수정하여 저장할 수 있습니다.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          <div>현재 탭: {activeTabMeta.label}</div>
          <div>플랜: {isProUser ? 'Pro' : 'Free'}</div>
          <div>품목 수: {items.length}개</div>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {/**
         * 탭 버튼 영역
         */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-lg border px-4 py-2 text-sm transition',
                activeTab === tab.key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/**
         * free 사용자 안내
         */}
        {!isProUser ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Free 플랜은 기본 시세 확인만 가능합니다. 시세 수정 및 저장은 Pro 플랜에서 사용할 수 있습니다.
          </div>
        ) : null}

        {/**
         * 항목이 없는 경우 안내
         */}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            현재 표시할 시세 항목이 없습니다.
            <br />
            defaultPrices.ts에 해당 탭 항목이 정상적으로 들어 있는지 확인해 주세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-zinc-100 text-zinc-700">
                  <th className="border-b px-4 py-3 text-left">품목</th>
                  <th className="border-b px-4 py-3 text-center">일반</th>
                  <th className="border-b px-4 py-3 text-center">고급</th>
                  <th className="border-b px-4 py-3 text-center">희귀</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const normalKey = buildEditKey(item.key, 'normal');
                  const advancedKey = buildEditKey(item.key, 'advanced');
                  const rareKey = buildEditKey(item.key, 'rare');

                  return (
                    <tr key={item.key} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.iconPath ? (
                            <Image
                              src={item.iconPath}
                              alt={item.name}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-sm object-contain"
                              onError={(e) => {
                                /**
                                 * 아이콘 파일이 아직 없거나 경로가 다를 수 있으므로
                                 * 이미지 로드 실패 시 이미지만 숨기고
                                 * 페이지 전체는 정상 동작하도록 처리한다.
                                 */
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}

                          <span>{item.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <MarketPriceInput
                          value={editedPrices[normalKey] ?? 0}
                          onChange={(value) =>
                            handleChangePrice(item.key, 'normal', value)
                          }
                          disabled={!isProUser}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <MarketPriceInput
                          value={editedPrices[advancedKey] ?? 0}
                          onChange={(value) =>
                            handleChangePrice(item.key, 'advanced', value)
                          }
                          disabled={!isProUser}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <MarketPriceInput
                          value={editedPrices[rareKey] ?? 0}
                          onChange={(value) =>
                            handleChangePrice(item.key, 'rare', value)
                          }
                          disabled={!isProUser}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <ActionButton
            onClick={handleSavePrices}
            disabled={!isProUser || saving || items.length === 0}
          >
            {saving ? '저장 중...' : '현재 탭 시세 저장'}
          </ActionButton>
        </div>
      </section>
    </main>
  );
}