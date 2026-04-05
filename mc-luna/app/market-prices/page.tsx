'use client';

/**
 * =========================
 * 시세 페이지 (market-prices)
 * =========================
 *
 * 이번 버전 목표:
 * 1) 탭 순서를 네비와 동일하게 맞춤
 *    - 낚시 / 농사 / 채광 / 요리 / 강화
 * 2) 공통 컴포넌트는 수정하지 않음
 * 3) 시세 탭 전용 입력 UI 사용
 *    - 숫자 오른쪽 정렬
 *    - 입력칸 오른쪽에 "셀" 표시
 * 4) 카테고리별 표시 구조 분기
 *    - triple: 일반 / 고급 / 희귀
 *    - cooking-result: 일반 결과물 / 일품 결과물
 *    - single: 단일 가격
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
import {
  COOKING_MARKET_ITEMS,
  ENHANCEMENT_MARKET_ITEMS,
  FARMING_MARKET_ITEMS,
  FISHING_MARKET_ITEMS,
  MINING_MARKET_ITEMS,
} from '@/src/lib/market/defaultPrices';

import type {
  MarketCategory,
  MarketGrade,
  MarketPriceItem,
  UserMarketPriceRow,
} from '@/src/lib/market/types';

type MarketTabKey =
  | 'fishing'
  | 'farming'
  | 'mining'
  | 'cooking'
  | 'enhancement';

const TAB_DEFINITIONS: {
  key: MarketTabKey;
  label: string;
  category: MarketCategory;
  items: MarketPriceItem[];
}[] = [
  {
    key: 'fishing',
    label: '낚시',
    category: 'fishing',
    items: FISHING_MARKET_ITEMS,
  },
  {
    key: 'farming',
    label: '농사',
    category: 'farming',
    items: FARMING_MARKET_ITEMS,
  },
  {
    key: 'mining',
    label: '채광',
    category: 'mining',
    items: MINING_MARKET_ITEMS,
  },
  {
    key: 'cooking',
    label: '요리',
    category: 'cooking',
    items: COOKING_MARKET_ITEMS,
  },
  {
    key: 'enhancement',
    label: '강화',
    category: 'enhancement',
    items: ENHANCEMENT_MARKET_ITEMS,
  },
];

/**
 * 편집 상태 key 생성
 */
function buildEditKey(itemKey: string, grade: string) {
  return `${itemKey}:${grade}`;
}

/**
 * 숫자 표시용 콤마 포맷
 */
function formatWithCommas(value: number) {
  return value.toLocaleString('ko-KR');
}

/**
 * 입력 문자열에서 숫자만 추출
 */
function extractDigits(value: string) {
  return value.replace(/[^\d]/g, '');
}

/**
 * 시세 탭 전용 입력 컴포넌트
 *
 * 공통 NumberInput을 건드리지 않고
 * 이 페이지에서만 오른쪽 정렬 + 셀 표시를 적용한다.
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
  const [displayValue, setDisplayValue] = useState(formatWithCommas(value));

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
          'text-right text-zinc-900 outline-none',
          'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
          'disabled:bg-zinc-100 disabled:text-zinc-500',
        ].join(' ')}
      />

      <span className="shrink-0 text-sm text-zinc-500">셀</span>
    </div>
  );
}

export default function MarketPricesPage() {
  /**
   * 접근 가드
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: '시세 탭을 사용하려면 로그인이 필요합니다.',
    profileMessage: '시세 탭을 사용하려면 마인크래프트 프로필 연동이 필요합니다.',
  });

  /**
   * 실제 로그인 사용자
   */
  const { user, loading: authLoading } = useAuth();

  /**
   * 페이지 상태
   */
  const [activeTab, setActiveTab] = useState<MarketTabKey>('fishing');
  const [planType, setPlanType] = useState<'free' | 'pro'>('free');
  const [items, setItems] = useState<MarketPriceItem[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /**
   * 중복 로딩 방지
   */
  const loadingRef = useRef(false);

  const activeTabMeta = useMemo(
    () => TAB_DEFINITIONS.find((tab) => tab.key === activeTab) ?? TAB_DEFINITIONS[0],
    [activeTab],
  );

  const isProUser = planType === 'pro';

  /**
   * 현재 탭 데이터 로드
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
       * 1) 플랜 조회
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
       * 2) 현재 탭 저장 시세 조회
       */
      const userRows = await loadUserMarketPrices(user.id, activeTabMeta.category);

      /**
       * 3) 기본값 + 저장값 merge
       */
      const mergedItems = mergeUserPrices(activeTabMeta.items, userRows);

      setItems(mergedItems);

      /**
       * 4) 편집 상태 초기화
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
   * 입력값 변경
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
   * 현재 탭 저장
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

      toast.success('현재 탭 시세를 저장했습니다.');
      await loadPageData();
    } catch (error) {
      console.error('market-prices 저장 중 예외:', error);
      toast.error('시세 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

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

        {!isProUser ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Free 플랜은 기본 시세 확인만 가능합니다. 시세 수정 및 저장은 Pro 플랜에서 사용할 수 있습니다.
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            현재 표시할 시세 항목이 없습니다.
            <br />
            defaultPrices.ts에 해당 탭 항목이 정상적으로 들어 있는지 확인해 주세요.
          </div>
        ) : activeTabMeta.category === 'cooking' ? (
          /**
           * 요리 탭:
           * - 일반 결과물 / 일품 결과물 2열
           */
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-zinc-100 text-zinc-700">
                  <th className="border-b px-4 py-3 text-left">품목</th>
                  <th className="border-b px-4 py-3 text-center">일반 결과물</th>
                  <th className="border-b px-4 py-3 text-center">일품 결과물</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const normalKey = buildEditKey(item.key, 'normal_result');
                  const specialKey = buildEditKey(item.key, 'special_result');

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
                            handleChangePrice(item.key, 'normal_result', value)
                          }
                          disabled={!isProUser}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <MarketPriceInput
                          value={editedPrices[specialKey] ?? 0}
                          onChange={(value) =>
                            handleChangePrice(item.key, 'special_result', value)
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
        ) : activeTabMeta.category === 'enhancement' ? (
          /**
           * 강화 탭:
           * - 단일 가격 1열
           */
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-zinc-100 text-zinc-700">
                  <th className="border-b px-4 py-3 text-left">품목</th>
                  <th className="border-b px-4 py-3 text-center">가격</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const singleKey = buildEditKey(item.key, 'single');

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
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <span>{item.name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <MarketPriceInput
                          value={editedPrices[singleKey] ?? 0}
                          onChange={(value) =>
                            handleChangePrice(item.key, 'single', value)
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
        ) : (
          /**
           * 낚시 / 농사 / 채광 탭:
           * - 일반 / 고급 / 희귀 3열
           */
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