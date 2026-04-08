// src/lib/fishing/calc.ts

import type {
  CatchExpectationResult,
  CatchTimeResult,
  FishingCalcConfig,
  FishingCalculationInput,
  FishingCalculationResult,
  GradeRatioResult,
  PondState,
  ValueResult,
} from "./types";
import {
  BAIT_EFFECTS,
  GROUNDBAIT_EFFECTS,
  getDoubleHookRow,
  getLineTensionValue,
  getRumoredBaitValue,
  getSchoolFishingRow,
} from "./skillTables";

/**
 * 기본 설정값
 */
export const DEFAULT_FISHING_CONFIG: FishingCalcConfig = {
  baseNibbleTicks: 360,
  baseBiteTicks: 90,

  senseNibbleCoeff: 0.9,
  senseBiteCoeff: 0.3,

  baseGradeNormal: 150,
  baseGradeAdvanced: 30,
  baseGradeRare: 15,

  luckGradeCoeff: 1.6,

  vanillaBasePercent: 20,
  vanillaLuckCoeff: 0.15,

  nightNibbleReductionRate: 0.05,
  nightBiteReductionRate: 0.03,

  lureEnchantReductionTicksPerLevel: 100,

  castStartSeconds: 0.7,
  reelInSeconds: 0.8,

  maxThirst: 100,
  averageThirst: 75,
};

/** 갈증 최소치에 대한 유효 계수 계산 함수 */
function getEffectiveThirstMultiplier(thirstMin: 15 | 10 | 5 | 1): number {
  switch (thirstMin) {
    case 15:
      return 1;
    case 10:
      return (6 * 1 + 5 * 0.75) / 11;
    case 5:
      return (6 * 1 + 5 * 0.75 + 5 * 0.5) / 16;
    case 1:
      return (6 * 1 + 5 * 0.75 + 5 * 0.5 + 4 * 0.25) / 20;
    default:
      return 1;
  }
}

/** 소수점 반올림 함수 */
function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 최소/최대값 제한 */
function clamp(
  value: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): number {
  return Math.min(Math.max(value, min), max);
}

/** 틱 -> 초 변환 */
function ticksToSeconds(ticks: number): number {
  return ticks / 20;
}

/** PondState에 따른 보정값 반환 */
function getPondModifiers(pondState: PondState) {
  switch (pondState) {
    case "abundant":
      return {
        nibbleRate: -0.08,
        biteRate: -0.12,
      };
    case "normal":
      return {
        nibbleRate: 0,
        biteRate: -0.05,
      };
    case "depleted":
      return {
        nibbleRate: 0.2,
        biteRate: 0.1,
      };
    default:
      return {
        nibbleRate: 0,
        biteRate: 0,
      };
  }
}

/** Partial config를 기본값과 합쳐서 완전한 config를 만든다 */
function mergeConfig(config?: Partial<FishingCalcConfig>): FishingCalcConfig {
  return {
    ...DEFAULT_FISHING_CONFIG,
    ...config,
  };
}

/**
 * 1회 낚시 시간 계산
 *
 * 계산 순서:
 * 1. 기본값
 * 2. 감각 적용
 * 3. 도감 기척 시간 감소 적용
 * 4. 밤 보정
 * 5. 어장 보정
 * 6. 미끼 보정
 * 7. 떡밥 보정
 * 8. 떼낚시 고정 감소
 * 9. Lure 인챈트 적용
 *
 * 이번 수정:
 * - 프로필 도감 효과인 "기척 시간 감소"를 감각 다음 단계에서 추가 차감
 * - 이 값은 입질 시간에는 직접 적용하지 않음
 */
export function calculateCatchTime(
  input: FishingCalculationInput,
): CatchTimeResult {
  const config = mergeConfig(input.config);
  const { stats, skills, environment } = input;

  const baitEffect = BAIT_EFFECTS[environment.baitType];
  const groundbaitEffect = GROUNDBAIT_EFFECTS[environment.groundbaitType];
  const pond = getPondModifiers(environment.pondState);

  const baseNibbleTicks = config.baseNibbleTicks;
  const baseBiteTicks = config.baseBiteTicks;

  /**
   * 감각 반영
   */
  const rawAfterSenseNibbleTicks =
    baseNibbleTicks - config.senseNibbleCoeff * stats.sense;
  const afterSenseBiteTicks =
    baseBiteTicks - config.senseBiteCoeff * stats.sense;

  /**
   * 도감 기척 시간 감소 반영
   * - 0 미만은 의미가 없으므로 clamp
   */
  const codexNibbleReduction = Math.max(0, stats.nibbleTimeReduction);
  const afterSenseNibbleTicks = rawAfterSenseNibbleTicks - codexNibbleReduction;

  const afterNightNibbleTicks =
    environment.timeOfDay === "night"
      ? afterSenseNibbleTicks * (1 - config.nightNibbleReductionRate)
      : afterSenseNibbleTicks;

  const afterNightBiteTicks =
    environment.timeOfDay === "night"
      ? afterSenseBiteTicks * (1 - config.nightBiteReductionRate)
      : afterSenseBiteTicks;

  const afterPondNibbleTicks =
    afterNightNibbleTicks * (1 + pond.nibbleRate);
  const afterPondBiteTicks =
    afterNightBiteTicks * (1 + pond.biteRate);

  const afterBaitNibbleTicks =
    afterPondNibbleTicks * (1 - baitEffect.nibbleReductionRate);
  const afterBaitBiteTicks =
    afterPondBiteTicks * (1 - baitEffect.biteReductionRate);

  const afterGroundbaitNibbleTicks =
    afterBaitNibbleTicks * (1 - groundbaitEffect.nibbleReductionRate);
  const afterGroundbaitBiteTicks =
    afterBaitBiteTicks * (1 - groundbaitEffect.biteReductionRate);

  let afterSchoolFishingNibbleTicks = afterGroundbaitNibbleTicks;
  let afterSchoolFishingBiteTicks = afterGroundbaitBiteTicks;

  if (environment.useSchoolFishing && skills.schoolFishing > 0) {
    const schoolFishingRow = getSchoolFishingRow(skills.schoolFishing);
    afterSchoolFishingNibbleTicks =
      afterGroundbaitNibbleTicks - schoolFishingRow.nibbleReductionTicks;
    afterSchoolFishingBiteTicks =
      afterGroundbaitBiteTicks - schoolFishingRow.biteReductionTicks;
  }

  const displayNibbleTicks = clamp(afterSchoolFishingNibbleTicks, 20);
  const displayBiteTicks = clamp(afterSchoolFishingBiteTicks, 1);

  const displayNibbleSeconds = ticksToSeconds(displayNibbleTicks);
  const displayBiteSeconds = ticksToSeconds(displayBiteTicks);

  const lureReductionTicks =
    clamp(environment.lureEnchantLevel, 0, 3) *
    config.lureEnchantReductionTicksPerLevel;

  const afterLureEnchantNibbleTicks = displayNibbleTicks - lureReductionTicks;
  const afterLureEnchantBiteTicks = displayBiteTicks;

  const finalNibbleTicks = clamp(afterLureEnchantNibbleTicks, 1);
  const finalBiteTicks = clamp(afterLureEnchantBiteTicks, 1);

  const finalNibbleSeconds = ticksToSeconds(finalNibbleTicks);
  const finalBiteSeconds = ticksToSeconds(finalBiteTicks);

  const castStartSeconds = config.castStartSeconds;
  const reelInSeconds = config.reelInSeconds;
  const waitSeconds = finalNibbleSeconds + finalBiteSeconds;
  const totalCycleSeconds = castStartSeconds + waitSeconds + reelInSeconds;

  return {
    baseNibbleTicks: round(baseNibbleTicks),
    baseBiteTicks: round(baseBiteTicks),
    afterSenseNibbleTicks: round(afterSenseNibbleTicks),
    afterSenseBiteTicks: round(afterSenseBiteTicks),
    displayNibbleTicks: round(displayNibbleTicks),
    displayBiteTicks: round(displayBiteTicks),
    displayNibbleSeconds: round(displayNibbleSeconds),
    displayBiteSeconds: round(displayBiteSeconds),
    afterLureEnchantNibbleTicks: round(afterLureEnchantNibbleTicks),
    afterLureEnchantBiteTicks: round(afterLureEnchantBiteTicks),
    afterNightNibbleTicks: round(afterNightNibbleTicks),
    afterNightBiteTicks: round(afterNightBiteTicks),
    afterPondNibbleTicks: round(afterPondNibbleTicks),
    afterPondBiteTicks: round(afterPondBiteTicks),
    afterBaitNibbleTicks: round(afterBaitNibbleTicks),
    afterBaitBiteTicks: round(afterBaitBiteTicks),
    afterGroundbaitNibbleTicks: round(afterGroundbaitNibbleTicks),
    afterGroundbaitBiteTicks: round(afterGroundbaitBiteTicks),
    afterSchoolFishingNibbleTicks: round(afterSchoolFishingNibbleTicks),
    afterSchoolFishingBiteTicks: round(afterSchoolFishingBiteTicks),
    finalNibbleTicks: round(finalNibbleTicks),
    finalBiteTicks: round(finalBiteTicks),
    finalNibbleSeconds: round(finalNibbleSeconds),
    finalBiteSeconds: round(finalBiteSeconds),
    castStartSeconds: round(castStartSeconds),
    reelInSeconds: round(reelInSeconds),
    waitSeconds: round(waitSeconds),
    totalCycleSeconds: round(totalCycleSeconds),
  };
}

/**
 * 물고기 등급 비율 계산
 *
 * 이번 수정:
 * - 일반 등급 감소는
 *   a) 낚싯줄 장력
 *   b) 도감 일반 물고기 감소비율
 *   을 합산 반영
 */
export function calculateGradeRatio(
  input: FishingCalculationInput,
): GradeRatioResult {
  const config = mergeConfig(input.config);
  const { stats, skills, environment } = input;
  const baitEffect = BAIT_EFFECTS[environment.baitType];

  const lineTensionReduction = getLineTensionValue(skills.lineTension);
  const codexNormalReduction = Math.max(0, stats.normalFishReduction);

  const rawNormal =
    config.baseGradeNormal - lineTensionReduction - codexNormalReduction;
  const rawAdvanced =
    config.baseGradeAdvanced +
    config.luckGradeCoeff * stats.luck +
    baitEffect.advancedBonus;
  const rawRare =
    config.baseGradeRare +
    config.luckGradeCoeff * stats.luck +
    baitEffect.rareBonus;

  const safeNormal = Math.max(0.0001, rawNormal);
  const safeAdvanced = Math.max(0.0001, rawAdvanced);
  const safeRare = Math.max(0.0001, rawRare);

  const total = safeNormal + safeAdvanced + safeRare;

  return {
    rawNormal: round(rawNormal),
    rawAdvanced: round(rawAdvanced),
    rawRare: round(rawRare),
    probabilityNormal: round(safeNormal / total, 6),
    probabilityAdvanced: round(safeAdvanced / total, 6),
    probabilityRare: round(safeRare / total, 6),
  };
}

/**
 * 바닐라 결과물 확률 계산
 * 공식: 20 - (0.15 * 행운)
 */
export function calculateVanillaChancePercent(
  input: FishingCalculationInput,
): number {
  const config = mergeConfig(input.config);
  const { stats } = input;

  return round(
    clamp(
      config.vanillaBasePercent - config.vanillaLuckCoeff * stats.luck,
      0,
      100,
    ),
  );
}

/**
 * 기대 획득량 계산
 * - 더블 캐치: 추가 물고기
 * - 2회 낚시: 추가 낚시 시도
 * - 미끼도 2회 낚시 확률을 추가 제공
 */
export function calculateCatchExpectation(
  input: FishingCalculationInput,
): CatchExpectationResult {
  const { stats, skills, environment } = input;

  const effectiveThirstMultiplier = getEffectiveThirstMultiplier(
    environment.thirstMin,
  );

  const rumoredBaitChancePercent = getRumoredBaitValue(skills.rumoredBait);

  const vanillaChancePercent = calculateVanillaChancePercent(input);
  const customFishChancePercent = 100 - vanillaChancePercent;
  const customFishChanceMultiplier = customFishChancePercent / 100;

  const doubleCatchChancePercent = clamp(
    6 * effectiveThirstMultiplier +
      0.45 * stats.luck +
      rumoredBaitChancePercent,
    0,
    100,
  );

  const skillDoubleCastChancePercent =
    environment.useDoubleHook && skills.doubleHook > 0
      ? getDoubleHookRow(skills.doubleHook).extraCatchChancePercent
      : 0;

  const baitDoubleCastChancePercent =
    BAIT_EFFECTS[environment.baitType].doubleCastChanceBonusPercent;

  const doubleCastChancePercent = clamp(
    skillDoubleCastChancePercent + baitDoubleCastChancePercent,
    0,
    100,
  );

  const customFishPerCatch = customFishChanceMultiplier;
  const finalCustomFishPerCatch =
    customFishPerCatch * (1 + doubleCatchChancePercent / 100);
  const fishPerCatch = 1 + doubleCatchChancePercent / 100;

  const catchCountPerCycle = 1 + doubleCastChancePercent / 100;

  const finalCustomFishPerCycle =
    finalCustomFishPerCatch * catchCountPerCycle;
  const finalFishPerCycle = fishPerCatch * catchCountPerCycle;

  const expCatchCountPerCycle = customFishPerCatch * catchCountPerCycle;

  return {
    selectedThirstMin: environment.thirstMin,
    effectiveThirstMultiplier: round(effectiveThirstMultiplier, 4),
    customFishChancePercent: round(customFishChancePercent),
    doubleCatchChancePercent: round(doubleCatchChancePercent),
    doubleCastChancePercent: round(doubleCastChancePercent),
    customFishPerCatch: round(customFishPerCatch),
    finalCustomFishPerCatch: round(finalCustomFishPerCatch),
    fishPerCatch: round(fishPerCatch),
    catchCountPerCycle: round(catchCountPerCycle),
    finalCustomFishPerCycle: round(finalCustomFishPerCycle),
    finalFishPerCycle: round(finalFishPerCycle),
    expCatchCountPerCycle: round(expCatchCountPerCycle),
  };
}

/** 기대 가치 계산 */
export function calculateValue(
  input: FishingCalculationInput,
  gradeRatio: GradeRatioResult,
  catchExpectation: CatchExpectationResult,
  catchTime: CatchTimeResult,
): ValueResult {
  const { prices } = input;

  const expectedValuePerFish =
    gradeRatio.probabilityNormal * prices.normal +
    gradeRatio.probabilityAdvanced * prices.advanced +
    gradeRatio.probabilityRare * prices.rare;

  const expectedValuePerCycle =
    expectedValuePerFish * catchExpectation.finalCustomFishPerCycle;

  const cyclesPerHour =
    catchTime.totalCycleSeconds > 0 ? 3600 / catchTime.totalCycleSeconds : 0;

  const expectedValuePerHour = expectedValuePerCycle * cyclesPerHour;

  const vanillaChancePercent = calculateVanillaChancePercent(input);
  const customFishChancePercent = 100 - vanillaChancePercent;

  return {
    expectedValuePerFish: round(expectedValuePerFish),
    expectedValuePerCycle: round(expectedValuePerCycle),
    expectedValuePerHour: round(expectedValuePerHour),
    vanillaChancePercent: round(vanillaChancePercent),
    customFishChancePercent: round(customFishChancePercent),
  };
}

/** 전체 낚시 계산 */
export function calculateFishing(
  input: FishingCalculationInput,
): FishingCalculationResult {
  const catchTime = calculateCatchTime(input);
  const gradeRatio = calculateGradeRatio(input);
  const catchExpectation = calculateCatchExpectation(input);
  const value = calculateValue(input, gradeRatio, catchExpectation, catchTime);

  return {
    catchTime,
    gradeRatio,
    catchExpectation,
    value,
  };
}