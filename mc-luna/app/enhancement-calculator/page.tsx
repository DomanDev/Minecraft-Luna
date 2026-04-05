"use client";

import { useMemo, useState } from "react";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";
import {
  calculateEnhancement,
  createRecommendedEnhancementStrategy,
  getEnhancementScrollInfo,
  getEnhancementStepDropRateOnFail,
  getEnhancementStepSuccessRate,
} from "@/src/lib/enhancement/calc";
import type {
  EnhancementCalculationInput,
  EnhancementLevel,
  EnhancementScrollType,
} from "@/src/lib/enhancement/types";

/**
 * =========================
 * 강화 계산기 옵션
 * =========================
 */

const levelOptions: { value: string; label: string }[] = Array.from(
  { length: 11 },
  (_, index) => ({
    value: index.toString(),
    label: `${index}강`,
  }),
);

const scrollOptions: { value: EnhancementScrollType; label: string }[] = [
  { value: "common", label: "일반 주문서" },
  { value: "uncommon", label: "고급 주문서" },
  { value: "rare", label: "희귀 주문서" },
];

/**
 * 권장 기본 전략:
 * 0~2 일반 / 3~5 고급 / 6~9 희귀
 */
const DEFAULT_STRATEGY = createRecommendedEnhancementStrategy();

const INITIAL_FORM = {
  currentLevel: 0 as EnhancementLevel,
  targetLevel: 10 as EnhancementLevel,

  useProtectionCharm: true,

  currentMoonAura: 100,
  maxMoonAura: 100,

  commonScrollPrice: 8000,
  uncommonScrollPrice: 18000,
  rareScrollPrice: 48000,
  protectionCharmPrice: 20000,
  moonAuraPotionPrice: 10000,
  moonAuraRecoveryPerPotion: 20,

  strategy0: DEFAULT_STRATEGY[0],
  strategy1: DEFAULT_STRATEGY[1],
  strategy2: DEFAULT_STRATEGY[2],
  strategy3: DEFAULT_STRATEGY[3],
  strategy4: DEFAULT_STRATEGY[4],
  strategy5: DEFAULT_STRATEGY[5],
  strategy6: DEFAULT_STRATEGY[6],
  strategy7: DEFAULT_STRATEGY[7],
  strategy8: DEFAULT_STRATEGY[8],
  strategy9: DEFAULT_STRATEGY[9],
};

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercentFromRatio(value: number, digits = 2): string {
  return `${formatNumber(value * 100, digits)}%`;
}

function createInitialInput(): EnhancementCalculationInput {
  return {
    currentLevel: INITIAL_FORM.currentLevel,
    targetLevel: INITIAL_FORM.targetLevel,
    useProtectionCharm: INITIAL_FORM.useProtectionCharm,
    currentMoonAura: INITIAL_FORM.currentMoonAura,
    maxMoonAura: INITIAL_FORM.maxMoonAura,
    prices: {
      commonScroll: INITIAL_FORM.commonScrollPrice,
      uncommonScroll: INITIAL_FORM.uncommonScrollPrice,
      rareScroll: INITIAL_FORM.rareScrollPrice,
      protectionCharm: INITIAL_FORM.protectionCharmPrice,
      moonAuraPotion: INITIAL_FORM.moonAuraPotionPrice,
    },
    moonAuraRecoveryPerPotion: INITIAL_FORM.moonAuraRecoveryPerPotion,
    strategy: {
      0: INITIAL_FORM.strategy0,
      1: INITIAL_FORM.strategy1,
      2: INITIAL_FORM.strategy2,
      3: INITIAL_FORM.strategy3,
      4: INITIAL_FORM.strategy4,
      5: INITIAL_FORM.strategy5,
      6: INITIAL_FORM.strategy6,
      7: INITIAL_FORM.strategy7,
      8: INITIAL_FORM.strategy8,
      9: INITIAL_FORM.strategy9,
    },
  };
}

export default function EnhancementCalculatorPage() {
  /**
   * 강화 계산기도 다른 계산기와 동일하게
   * 로그인 + 프로필 연동 가드를 먼저 통과해야 접근 가능
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "강화 계산기를 사용하려면 로그인이 필요합니다.",
    profileMessage: "강화 계산기를 사용하려면 프로필 연동이 필요합니다.",
  });

  const [currentLevel, setCurrentLevel] = useState(INITIAL_FORM.currentLevel);
  const [targetLevel, setTargetLevel] = useState(INITIAL_FORM.targetLevel);

  const [useProtectionCharm, setUseProtectionCharm] = useState(
    INITIAL_FORM.useProtectionCharm,
  );

  const [currentMoonAura, setCurrentMoonAura] = useState(
    INITIAL_FORM.currentMoonAura,
  );
  const [maxMoonAura, setMaxMoonAura] = useState(INITIAL_FORM.maxMoonAura);

  const [commonScrollPrice, setCommonScrollPrice] = useState(
    INITIAL_FORM.commonScrollPrice,
  );
  const [uncommonScrollPrice, setUncommonScrollPrice] = useState(
    INITIAL_FORM.uncommonScrollPrice,
  );
  const [rareScrollPrice, setRareScrollPrice] = useState(
    INITIAL_FORM.rareScrollPrice,
  );
  const [protectionCharmPrice, setProtectionCharmPrice] = useState(
    INITIAL_FORM.protectionCharmPrice,
  );
  const [moonAuraPotionPrice, setMoonAuraPotionPrice] = useState(
    INITIAL_FORM.moonAuraPotionPrice,
  );
  const [moonAuraRecoveryPerPotion, setMoonAuraRecoveryPerPotion] = useState(
    INITIAL_FORM.moonAuraRecoveryPerPotion,
  );

  /**
   * 단계별 주문서 전략
   *
   * level n 값은
   * n강 -> n+1강 시도에 사용할 주문서를 의미한다.
   */
  const [strategy0, setStrategy0] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy0,
  );
  const [strategy1, setStrategy1] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy1,
  );
  const [strategy2, setStrategy2] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy2,
  );
  const [strategy3, setStrategy3] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy3,
  );
  const [strategy4, setStrategy4] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy4,
  );
  const [strategy5, setStrategy5] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy5,
  );
  const [strategy6, setStrategy6] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy6,
  );
  const [strategy7, setStrategy7] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy7,
  );
  const [strategy8, setStrategy8] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy8,
  );
  const [strategy9, setStrategy9] = useState<EnhancementScrollType>(
    INITIAL_FORM.strategy9,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [result, setResult] = useState(() =>
    calculateEnhancement(createInitialInput()),
  );

  /**
   * 현재 입력값을 계산기 입력 타입으로 변환
   */
  const buildInput = (): EnhancementCalculationInput => {
    return {
      currentLevel,
      targetLevel,
      useProtectionCharm,
      currentMoonAura,
      maxMoonAura,
      prices: {
        commonScroll: commonScrollPrice,
        uncommonScroll: uncommonScrollPrice,
        rareScroll: rareScrollPrice,
        protectionCharm: protectionCharmPrice,
        moonAuraPotion: moonAuraPotionPrice,
      },
      moonAuraRecoveryPerPotion,
      strategy: {
        0: strategy0,
        1: strategy1,
        2: strategy2,
        3: strategy3,
        4: strategy4,
        5: strategy5,
        6: strategy6,
        7: strategy7,
        8: strategy8,
        9: strategy9,
      },
    };
  };

  const handleCalculate = () => {
    try {
      setErrorMessage(null);
      const nextResult = calculateEnhancement(buildInput());
      setResult(nextResult);
      setIsDirty(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "강화 계산 중 알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
    }
  };

  /**
   * 추천 전략 자동 적용
   *
   * 0~2 일반 / 3~5 고급 / 6~9 희귀
   */
  const handleApplyRecommendedStrategy = () => {
    const recommended = createRecommendedEnhancementStrategy();

    setStrategy0(recommended[0]);
    setStrategy1(recommended[1]);
    setStrategy2(recommended[2]);
    setStrategy3(recommended[3]);
    setStrategy4(recommended[4]);
    setStrategy5(recommended[5]);
    setStrategy6(recommended[6]);
    setStrategy7(recommended[7]);
    setStrategy8(recommended[8]);
    setStrategy9(recommended[9]);

    setIsDirty(true);
  };

  const handleReset = () => {
    setCurrentLevel(INITIAL_FORM.currentLevel);
    setTargetLevel(INITIAL_FORM.targetLevel);

    setUseProtectionCharm(INITIAL_FORM.useProtectionCharm);

    setCurrentMoonAura(INITIAL_FORM.currentMoonAura);
    setMaxMoonAura(INITIAL_FORM.maxMoonAura);

    setCommonScrollPrice(INITIAL_FORM.commonScrollPrice);
    setUncommonScrollPrice(INITIAL_FORM.uncommonScrollPrice);
    setRareScrollPrice(INITIAL_FORM.rareScrollPrice);
    setProtectionCharmPrice(INITIAL_FORM.protectionCharmPrice);
    setMoonAuraPotionPrice(INITIAL_FORM.moonAuraPotionPrice);
    setMoonAuraRecoveryPerPotion(INITIAL_FORM.moonAuraRecoveryPerPotion);

    setStrategy0(INITIAL_FORM.strategy0);
    setStrategy1(INITIAL_FORM.strategy1);
    setStrategy2(INITIAL_FORM.strategy2);
    setStrategy3(INITIAL_FORM.strategy3);
    setStrategy4(INITIAL_FORM.strategy4);
    setStrategy5(INITIAL_FORM.strategy5);
    setStrategy6(INITIAL_FORM.strategy6);
    setStrategy7(INITIAL_FORM.strategy7);
    setStrategy8(INITIAL_FORM.strategy8);
    setStrategy9(INITIAL_FORM.strategy9);

    setErrorMessage(null);
    setResult(calculateEnhancement(createInitialInput()));
    setIsDirty(false);
  };

  /**
   * 화면 상단 설명용 주문서 정보
   */
  const commonInfo = useMemo(() => getEnhancementScrollInfo("common"), []);
  const uncommonInfo = useMemo(() => getEnhancementScrollInfo("uncommon"), []);
  const rareInfo = useMemo(() => getEnhancementScrollInfo("rare"), []);

  /**
   * 결과 표시에 사용할 단계 목록
   */
  const visibleLevels = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => index).filter(
      (level) => level >= currentLevel && level < targetLevel,
    );
  }, [currentLevel, targetLevel]);

  /**
   * 공통 가드 확인 중이거나 아직 접근이 허용되지 않은 경우
   */
  if (guardLoading || !allowed) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          강화 계산기
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      title="강화 계산기"
      left={
        <div className="space-y-6">
          <CalculatorPanel title="강화 정보">
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">
                  생활 장비 주문서 강화 규칙 요약
                </p>
                <div className="mt-2 space-y-1 leading-6">
                  <p>
                    일반 주문서: {commonInfo.minLevel}~{commonInfo.maxLevel}강 사용,
                    성공 시 스탯 +{commonInfo.statIncreaseOnSuccess}, 실패 시 기운 -
                    {commonInfo.moonAuraLossOnFail}
                  </p>
                  <p>
                    고급 주문서: {uncommonInfo.minLevel}~{uncommonInfo.maxLevel}강
                    사용, 성공 시 스탯 +{uncommonInfo.statIncreaseOnSuccess}, 실패 시
                    기운 -{uncommonInfo.moonAuraLossOnFail}
                  </p>
                  <p>
                    희귀 주문서: {rareInfo.minLevel}~{rareInfo.maxLevel}강 사용,
                    성공 시 스탯 +{rareInfo.statIncreaseOnSuccess}, 실패 시 기운 -
                    {rareInfo.moonAuraLossOnFail}
                  </p>
                  <p>달빛 부적은 하락이 실제 발생할 때만 소모된다고 가정합니다.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="현재 강화 단계">
                  <SelectInput
                    value={currentLevel.toString()}
                    options={levelOptions}
                    onChange={(value) => {
                      setCurrentLevel(Number(value) as EnhancementLevel);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="목표 강화 단계">
                  <SelectInput
                    value={targetLevel.toString()}
                    options={levelOptions}
                    onChange={(value) => {
                      setTargetLevel(Number(value) as EnhancementLevel);
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="현재 달빛 기운">
                  <NumberInput
                    value={currentMoonAura}
                    min={0}
                    max={100}
                    onChange={(value) => {
                      setCurrentMoonAura(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="최대 달빛 기운">
                  <NumberInput
                    value={maxMoonAura}
                    min={1}
                    max={100}
                    onChange={(value) => {
                      setMaxMoonAura(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={useProtectionCharm}
                  onChange={(event) => {
                    setUseProtectionCharm(event.target.checked);
                    setIsDirty(true);
                  }}
                />
                <span>하락 방지용 달빛 부적 사용</span>
              </label>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="구간별 주문서 전략">
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">추천 전략</p>
                <p className="mt-1">
                  보편적인 추천값은 0~2 일반 / 3~5 고급 / 6~9 희귀입니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={handleApplyRecommendedStrategy}>
                  추천 전략 적용
                </ActionButton>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="0강 → 1강 주문서">
                  <SelectInput
                    value={strategy0}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy0(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="1강 → 2강 주문서">
                  <SelectInput
                    value={strategy1}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy1(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="2강 → 3강 주문서">
                  <SelectInput
                    value={strategy2}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy2(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="3강 → 4강 주문서">
                  <SelectInput
                    value={strategy3}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy3(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="4강 → 5강 주문서">
                  <SelectInput
                    value={strategy4}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy4(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="5강 → 6강 주문서">
                  <SelectInput
                    value={strategy5}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy5(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="6강 → 7강 주문서">
                  <SelectInput
                    value={strategy6}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy6(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="7강 → 8강 주문서">
                  <SelectInput
                    value={strategy7}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy7(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="8강 → 9강 주문서">
                  <SelectInput
                    value={strategy8}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy8(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="9강 → 10강 주문서">
                  <SelectInput
                    value={strategy9}
                    options={scrollOptions}
                    onChange={(value) => {
                      setStrategy9(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="재료 시세">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="일반 주문서 가격">
                  <NumberInput
                    value={commonScrollPrice}
                    min={0}
                    onChange={(value) => {
                      setCommonScrollPrice(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="고급 주문서 가격">
                  <NumberInput
                    value={uncommonScrollPrice}
                    min={0}
                    onChange={(value) => {
                      setUncommonScrollPrice(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="희귀 주문서 가격">
                  <NumberInput
                    value={rareScrollPrice}
                    min={0}
                    onChange={(value) => {
                      setRareScrollPrice(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="달빛 부적 가격">
                  <NumberInput
                    value={protectionCharmPrice}
                    min={0}
                    onChange={(value) => {
                      setProtectionCharmPrice(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="달빛 기운 농축액 가격">
                  <NumberInput
                    value={moonAuraPotionPrice}
                    min={0}
                    onChange={(value) => {
                      setMoonAuraPotionPrice(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="농축액 1개당 회복량">
                  <NumberInput
                    value={moonAuraRecoveryPerPotion}
                    min={1}
                    onChange={(value) => {
                      setMoonAuraRecoveryPerPotion(value);
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>
            </div>
          </CalculatorPanel>

          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
            <ActionButton onClick={handleReset} variant="secondary">
              전체 초기화
            </ActionButton>
          </div>

          {isDirty && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {errorMessage}
            </div>
          )}
        </div>
      }
      right={
        <CalculatorPanel title="계산 결과">
          <ResultCard title="강화 단계별 확률">
            <div className="space-y-2">
              {visibleLevels.map((level) => (
                <div
                  key={level}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-zinc-900">
                      {level}강 → {level + 1}강
                    </span>
                    <span className="text-zinc-700">
                      성공 {formatPercentFromRatio(getEnhancementStepSuccessRate(level), 2)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm text-zinc-700">
                    <span>실패 시 하락 확률</span>
                    <span>
                      {formatPercentFromRatio(
                        getEnhancementStepDropRateOnFail(level),
                        2,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ResultCard>

          <ResultCard title="단계별 기대 비용">
            <div className="space-y-3">
              {result.steps.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  현재 강화 단계가 목표 이상이므로 추가 비용이 없습니다.
                </p>
              ) : (
                result.steps.map((step) => (
                  <div
                    key={`${step.fromLevel}-${step.toLevelOnSuccess}`}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-zinc-900">
                        {step.fromLevel}강 → {step.toLevelOnSuccess}강
                      </span>
                      <span className="font-semibold text-zinc-900">
                        {formatNumber(step.expectedCostToClearStep, 2)}셀
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-zinc-700">
                      <div className="flex justify-between">
                        <span>사용 주문서</span>
                        <span>{getEnhancementScrollInfo(step.scrollType).label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>성공 확률</span>
                        <span>{formatPercentFromRatio(step.successRate, 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>실패 시 하락 확률</span>
                        <span>{formatPercentFromRatio(step.dropRateOnFail, 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>시도 1회 기준 주문서 비용</span>
                        <span>{formatNumber(step.scrollCost, 2)}셀</span>
                      </div>
                      <div className="flex justify-between">
                        <span>실패 시 달빛 기운 감소</span>
                        <span>{formatNumber(step.moonAuraLossOnFail, 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>시도 1회 기준 기대 기운 복구비</span>
                        <span>
                          {formatNumber(
                            step.expectedMoonAuraRecoveryCostPerAttempt,
                            2,
                          )}
                          셀
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>시도 1회 기준 기대 부적 비용</span>
                        <span>
                          {formatNumber(step.expectedProtectionCostPerAttempt, 2)}셀
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>시도 1회 기준 총 기대비용</span>
                        <span>{formatNumber(step.expectedAttemptCost, 2)}셀</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ResultCard>

          <ResultCard title="전체 기대 비용">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>현재 강화 단계</span>
                <span>{result.currentLevel}강</span>
              </div>
              <div className="flex justify-between">
                <span>목표 강화 단계</span>
                <span>{result.targetLevel}강</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>총 기대 비용</span>
                <span className="font-semibold text-zinc-900">
                  {formatNumber(result.summary.totalExpectedCost, 2)}셀
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="space-y-1 text-sm text-blue-900">
                <p className="font-semibold">요약 안내</p>
                <p>
                  아래 세 값은 단계별 시도 1회 기준 비용 성분을 합친 안내치이며,
                  최종 총 기대 비용과 완전히 동일하게 대응하는 값은 아닙니다.
                </p>
              </div>

              <div className="mt-3 space-y-2 text-sm text-blue-900">
                <div className="flex justify-between">
                  <span>주문서 비용 합(안내)</span>
                  <span>{formatNumber(result.summary.totalExpectedScrollCost, 2)}셀</span>
                </div>
                <div className="flex justify-between">
                  <span>부적 비용 합(안내)</span>
                  <span>
                    {formatNumber(result.summary.totalExpectedProtectionCost, 2)}셀
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>기운 복구비 합(안내)</span>
                  <span>
                    {formatNumber(
                      result.summary.totalExpectedMoonAuraRecoveryCost,
                      2,
                    )}
                    셀
                  </span>
                </div>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="안내">
            <div className="space-y-2 text-sm text-zinc-700">
              {result.notes.map((note) => (
                <p key={note}>• {note}</p>
              ))}
            </div>
          </ResultCard>
        </CalculatorPanel>
      }
    />
  );
}