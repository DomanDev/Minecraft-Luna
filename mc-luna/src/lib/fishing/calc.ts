/**
 * src/lib/fishing/calc.ts
 * 낚시 계산기 핵심 계산 로직 파일
 */

import type {
  CatchExpectationResult,
  CatchTimeResult,
  FishingCalcConfig,
  FishingCalculationInput,
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
 * 낚시 계산 기본 상수 설정값
 */
export const DEFAULT_FISHING_CONFIG: FishingCalcConfig = {
  baseNibbleTicks: 360,
  baseBiteTicks: 90,
  senseNibbleCoeff: 0.9,
  senseBiteCoeff: 0.3,
  baseGradeNormal: 110,
  baseGradeAdvanced: 45,
  baseGradeRare: 25,
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

/**
 * 갈증 최소치 드롭다운 선택에 따른 평균 효율 계수
 */
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

/**
 * 소수점 반올림 함수
 */
function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * 값 범위를 제한하는 보정 함수
 */
function clamp(
  value: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 틱 단위를 초 단위로 변환하는 함수
 */
function ticksToSeconds(ticks: number): number {
  return ticks / 20;
}

/**
 * 어장 상태에 따른 시간 보정값 반환 함수
 */
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

/**
 * 부분 설정값을 기본 설정값과 병합하는 함수
 */
function mergeConfig(config?: Partial<FishingCalcConfig>): FishingCalcConfig {
  return {
    ...DEFAULT_FISHING_CONFIG,
    ...config,
  };
}

/**
 * 1시간 동안 스킬이 몇 번 사용되고 몇 초 유지되는지 계산하는 함수
 * 시작 시점 0초에 즉시 1회 사용한다고 가정한다.
 */
function calculateSkillUptime(durationSeconds: number, cooldownSeconds: number) {
  /** 1시간 기준 총 초 */
  const ONE_HOUR_SECONDS = 3600;

  /** 시간당 사용 횟수 */
  let usesPerHour = 0;

  /** 시간당 총 활성 시간 */
  let activeSecondsPerHour = 0;

  /** 비정상 값이면 즉시 0 반환 */
  if (durationSeconds <= 0 || cooldownSeconds <= 0) {
    return {
      usesPerHour: 0,
      activeSecondsPerHour: 0,
      activeRatio: 0,
    };
  }

  /** 시전 시작 시각을 쿨타임 간격으로 순회 */
  for (
    let castStart = 0;
    castStart < ONE_HOUR_SECONDS;
    castStart += cooldownSeconds
  ) {
    /** 현재 시전 횟수 증가 */
    usesPerHour += 1;

    /** 이번 시전의 시작 시각 */
    const activeStart = castStart;

    /** 이번 시전의 종료 시각 */
    const activeEnd = Math.min(
      castStart + durationSeconds,
      ONE_HOUR_SECONDS,
    );

    /** 1시간 구간 안에 포함되는 활성 시간 누적 */
    activeSecondsPerHour += Math.max(0, activeEnd - activeStart);
  }

  return {
    usesPerHour,
    activeSecondsPerHour: round(activeSecondsPerHour, 4),
    activeRatio: round(activeSecondsPerHour / ONE_HOUR_SECONDS, 6),
  };
}

/**
 * 떼낚시 미적용 기준 1회 낚시 시간 계산 함수
 * 표시 시간도 이 값을 기준으로 유지한다.
 */
function calculateBaseCatchTime(
  input: FishingCalculationInput,
): CatchTimeResult {
  /** 설정 병합 결과 */
  const config = mergeConfig(input.config);

  /** 입력 데이터에서 주요 그룹 분리 */
  const { stats, environment } = input;

  /** 선택한 미끼 효과 */
  const baitEffect = BAIT_EFFECTS[environment.baitType];

  /** 선택한 떡밥 효과 */
  const groundbaitEffect = GROUNDBAIT_EFFECTS[environment.groundbaitType];

  /** 선택한 어장 상태 보정 */
  const pond = getPondModifiers(environment.pondState);

  /** 기본 기척 시간 틱 */
  const baseNibbleTicks = config.baseNibbleTicks;

  /** 기본 입질 시간 틱 */
  const baseBiteTicks = config.baseBiteTicks;

  /** 감각 적용 전용 기척 시간 */
  const rawAfterSenseNibbleTicks =
    baseNibbleTicks - config.senseNibbleCoeff * stats.sense;

  /** 감각 적용 후 입질 시간 */
  const afterSenseBiteTicks =
    baseBiteTicks - config.senseBiteCoeff * stats.sense;

  /** 도감 기척 시간 감소량 */
  const codexNibbleReduction = Math.max(0, stats.nibbleTimeReduction);

  /** 감각 + 도감 적용 후 기척 시간 */
  const afterSenseNibbleTicks =
    rawAfterSenseNibbleTicks - codexNibbleReduction;

  /** 밤 시간대 보정 후 기척 시간 */
  const afterNightNibbleTicks =
    environment.timeOfDay === "night"
      ? afterSenseNibbleTicks * (1 - config.nightNibbleReductionRate)
      : afterSenseNibbleTicks;

  /** 밤 시간대 보정 후 입질 시간 */
  const afterNightBiteTicks =
    environment.timeOfDay === "night"
      ? afterSenseBiteTicks * (1 - config.nightBiteReductionRate)
      : afterSenseBiteTicks;

  /** 어장 상태 보정 후 기척 시간 */
  const afterPondNibbleTicks =
    afterNightNibbleTicks * (1 + pond.nibbleRate);

  /** 어장 상태 보정 후 입질 시간 */
  const afterPondBiteTicks =
    afterNightBiteTicks * (1 + pond.biteRate);

  /** 미끼 적용 후 기척 시간 */
  const afterBaitNibbleTicks =
    afterPondNibbleTicks * (1 - baitEffect.nibbleReductionRate);

  /** 미끼 적용 후 입질 시간 */
  const afterBaitBiteTicks =
    afterPondBiteTicks * (1 - baitEffect.biteReductionRate);

  /** 떡밥 적용 후 기척 시간 */
  const afterGroundbaitNibbleTicks =
    afterBaitNibbleTicks * (1 - groundbaitEffect.nibbleReductionRate);

  /** 떡밥 적용 후 입질 시간 */
  const afterGroundbaitBiteTicks =
    afterBaitBiteTicks * (1 - groundbaitEffect.biteReductionRate);

  /** 화면에 표시되는 기척 시간 틱 */
  const displayNibbleTicks = clamp(afterGroundbaitNibbleTicks, 20);

  /** 화면에 표시되는 입질 시간 틱 */
  const displayBiteTicks = clamp(afterGroundbaitBiteTicks, 1);

  /** 화면에 표시되는 기척 시간 초 */
  const displayNibbleSeconds = ticksToSeconds(displayNibbleTicks);

  /** 화면에 표시되는 입질 시간 초 */
  const displayBiteSeconds = ticksToSeconds(displayBiteTicks);

  /** Lure 인챈트에 따른 기척 시간 감소량 */
  const lureReductionTicks =
    clamp(environment.lureEnchantLevel, 0, 3) *
    config.lureEnchantReductionTicksPerLevel;

  /** Lure 적용 후 기척 시간 틱 */
  const afterLureEnchantNibbleTicks =
    displayNibbleTicks - lureReductionTicks;

  /** Lure는 입질 시간에 직접 영향이 없어 그대로 유지 */
  const afterLureEnchantBiteTicks = displayBiteTicks;

  /** 최종 실제 기척 시간 틱 */
  const finalNibbleTicks = clamp(afterLureEnchantNibbleTicks, 1);

  /** 최종 실제 입질 시간 틱 */
  const finalBiteTicks = clamp(afterLureEnchantBiteTicks, 1);

  /** 최종 실제 기척 시간 초 */
  const finalNibbleSeconds = ticksToSeconds(finalNibbleTicks);

  /** 최종 실제 입질 시간 초 */
  const finalBiteSeconds = ticksToSeconds(finalBiteTicks);

  /** 낚싯대 던지는 시간 */
  const castStartSeconds = config.castStartSeconds;

  /** 물고기 건져올리는 시간 */
  const reelInSeconds = config.reelInSeconds;

  /** 실제 대기 시간 합계 */
  const waitSeconds = finalNibbleSeconds + finalBiteSeconds;

  /** 최종 1회 낚시 총 소요 시간 */
  const totalCycleSeconds =
    castStartSeconds + waitSeconds + reelInSeconds;

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
    afterSchoolFishingNibbleTicks: round(afterGroundbaitNibbleTicks),
    afterSchoolFishingBiteTicks: round(afterGroundbaitBiteTicks),
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
 * 떼낚시 적용 기준 1회 낚시 시간 계산 함수
 * 결과표 표시용이 아니라 내부 시간당 수익 계산용이다.
 */
function calculateSchoolFishingCatchTime(
  input: FishingCalculationInput,
): CatchTimeResult {
  /** 기본 시간 계산 결과 */
  const baseCatchTime = calculateBaseCatchTime(input);

  /** 떼낚시 미사용이면 기본 시간 그대로 반환 */
  if (!input.environment.useSchoolFishing || input.skills.schoolFishing <= 0) {
    return baseCatchTime;
  }

  /** 선택한 떼낚시 레벨 정보 */
  const schoolFishingRow = getSchoolFishingRow(input.skills.schoolFishing);

  /** 떼낚시 적용 후 기척 시간 틱 */
  const afterSchoolFishingNibbleTicks = clamp(
    baseCatchTime.afterGroundbaitNibbleTicks -
      schoolFishingRow.nibbleReductionTicks,
    20,
  );

  /** 떼낚시 적용 후 입질 시간 틱 */
  const afterSchoolFishingBiteTicks = clamp(
    baseCatchTime.afterGroundbaitBiteTicks -
      schoolFishingRow.biteReductionTicks,
    1,
  );

  /** Lure 인챈트 감소량 */
  const lureReductionTicks =
    clamp(input.environment.lureEnchantLevel, 0, 3) *
    mergeConfig(input.config).lureEnchantReductionTicksPerLevel;

  /** 떼낚시 + Lure 적용 후 실제 기척 시간 틱 */
  const finalNibbleTicks = clamp(
    afterSchoolFishingNibbleTicks - lureReductionTicks,
    1,
  );

  /** 떼낚시 적용 후 실제 입질 시간 틱 */
  const finalBiteTicks = clamp(afterSchoolFishingBiteTicks, 1);

  /** 떼낚시 적용 후 실제 기척 시간 초 */
  const finalNibbleSeconds = ticksToSeconds(finalNibbleTicks);

  /** 떼낚시 적용 후 실제 입질 시간 초 */
  const finalBiteSeconds = ticksToSeconds(finalBiteTicks);

  /** 설정 병합 결과 */
  const config = mergeConfig(input.config);

  /** 낚싯대 던지는 시간 */
  const castStartSeconds = config.castStartSeconds;

  /** 물고기 건져올리는 시간 */
  const reelInSeconds = config.reelInSeconds;

  /** 떼낚시 적용 후 대기 시간 */
  const waitSeconds = finalNibbleSeconds + finalBiteSeconds;

  /** 떼낚시 적용 후 1회 총 소요 시간 */
  const totalCycleSeconds =
    castStartSeconds + waitSeconds + reelInSeconds;

  return {
    ...baseCatchTime,
    afterSchoolFishingNibbleTicks: round(afterSchoolFishingNibbleTicks),
    afterSchoolFishingBiteTicks: round(afterSchoolFishingBiteTicks),
    displayNibbleTicks: round(afterSchoolFishingNibbleTicks),
    displayBiteTicks: round(afterSchoolFishingBiteTicks),
    displayNibbleSeconds: round(ticksToSeconds(afterSchoolFishingNibbleTicks)),
    displayBiteSeconds: round(ticksToSeconds(afterSchoolFishingBiteTicks)),
    afterLureEnchantNibbleTicks: round(
      afterSchoolFishingNibbleTicks - lureReductionTicks,
    ),
    afterLureEnchantBiteTicks: round(afterSchoolFishingBiteTicks),
    finalNibbleTicks: round(finalNibbleTicks),
    finalBiteTicks: round(finalBiteTicks),
    finalNibbleSeconds: round(finalNibbleSeconds),
    finalBiteSeconds: round(finalBiteSeconds),
    waitSeconds: round(waitSeconds),
    totalCycleSeconds: round(totalCycleSeconds),
  };
}

/**
 * 기존 외부 호출 호환용 기본 낚시 시간 계산 함수
 * 결과표 표시는 항상 기본 시간 기준으로 유지한다.
 */
export function calculateCatchTime(
  input: FishingCalculationInput,
): CatchTimeResult {
  return calculateBaseCatchTime(input);
}

/**
 * 물고기 등급 비율 계산 함수
 */
export function calculateGradeRatio(
  input: FishingCalculationInput,
): GradeRatioResult {
  /** 설정 병합 결과 */
  const config = mergeConfig(input.config);

  /** 입력 데이터에서 주요 그룹 분리 */
  const { stats, skills, environment } = input;

  /** 선택한 미끼 효과 */
  const baitEffect = BAIT_EFFECTS[environment.baitType];

  /** 낚싯줄 장력에 따른 일반 물고기 감소량 */
  const lineTensionReduction = getLineTensionValue(skills.lineTension);

  /** 도감 일반 물고기 감소량 */
  const codexNormalReduction = Math.max(0, stats.normalFishReduction);

  /** 일반 등급 원시 가중치 */
  const rawNormal =
    config.baseGradeNormal - lineTensionReduction - codexNormalReduction;

  /** 고급 등급 원시 가중치 */
  const rawAdvanced =
    config.baseGradeAdvanced +
    config.luckGradeCoeff * stats.luck +
    baitEffect.advancedBonus;

  /** 희귀 등급 원시 가중치 */
  const rawRare =
    config.baseGradeRare +
    config.luckGradeCoeff * stats.luck +
    baitEffect.rareBonus;

  /** 일반 등급 안전 보정값 */
  const safeNormal = Math.max(0.0001, rawNormal);

  /** 고급 등급 안전 보정값 */
  const safeAdvanced = Math.max(0.0001, rawAdvanced);

  /** 희귀 등급 안전 보정값 */
  const safeRare = Math.max(0.0001, rawRare);

  /** 전체 가중치 합계 */
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
 * 바닐라 결과물 확률 계산 함수
 */
export function calculateVanillaChancePercent(
  input: FishingCalculationInput,
): number {
  /** 설정 병합 결과 */
  const config = mergeConfig(input.config);

  /** 입력 데이터에서 스탯 분리 */
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
 * 쌍걸이 미적용 기준 기대 획득량 계산 함수
 */
function calculateBaseCatchExpectation(
  input: FishingCalculationInput,
): CatchExpectationResult {
  /** 입력 데이터에서 주요 그룹 분리 */
  const { stats, skills, environment } = input;

  /** 갈증 최소치 평균 효율 */
  const effectiveThirstMultiplier = getEffectiveThirstMultiplier(
    environment.thirstMin,
  );

  /** 소문난 미끼 확률 보너스 */
  const rumoredBaitChancePercent = getRumoredBaitValue(skills.rumoredBait);

  /** 바닐라 결과물 확률 */
  const vanillaChancePercent = calculateVanillaChancePercent(input);

  /** 커스텀 물고기 확률 */
  const customFishChancePercent = 100 - vanillaChancePercent;

  /** 커스텀 물고기 확률 배수 */
  const customFishChanceMultiplier = customFishChancePercent / 100;

  /** 더블 캐치 확률 */
  const doubleCatchChancePercent = clamp(
    5 + //기본확률(04.23 패치)
    6 * effectiveThirstMultiplier +
      0.5 * stats.luck +
      rumoredBaitChancePercent,
    0,
    100,
  );

  /** 미끼가 주는 2회 낚시 확률 보너스 */
  const baitDoubleCastChancePercent =
    BAIT_EFFECTS[environment.baitType].doubleCastChanceBonusPercent;

  /** 쌍걸이 미적용 기준 2회 낚시 확률 */
  const doubleCastChancePercent = clamp(
    5 + // 기본확률
    baitDoubleCastChancePercent,
    0,
    100,
  );

  /** 1회 낚시당 커스텀 물고기 기대 획득량 */
  const customFishPerCatch = customFishChanceMultiplier;

  /** 더블 캐치 반영 후 1회당 커스텀 물고기 기대 획득량 */
  const finalCustomFishPerCatch =
    customFishPerCatch * (1 + doubleCatchChancePercent / 100);

  /** 1회 낚시당 전체 물고기 기대 획득량 */
  const fishPerCatch = 1 + doubleCatchChancePercent / 100;

  /** 1사이클당 낚시 시도 횟수 기대값 */
  const catchCountPerCycle = 1 + doubleCastChancePercent / 100;

  /** 1사이클당 커스텀 물고기 기대 획득량 */
  const finalCustomFishPerCycle =
    finalCustomFishPerCatch * catchCountPerCycle;

  /** 1사이클당 전체 물고기 기대 획득량 */
  const finalFishPerCycle = fishPerCatch * catchCountPerCycle;

  /** 1사이클당 커스텀 낚시 시도 기대값 */
  const expCatchCountPerCycle =
    customFishPerCatch * catchCountPerCycle;

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

/**
 * 쌍걸이 적용 기준 기대 획득량 계산 함수
 * 결과표 표시용이 아니라 내부 시간당 수익 계산용이다.
 */
function calculateDoubleHookCatchExpectation(
  input: FishingCalculationInput,
): CatchExpectationResult {
  /** 기본 기대 획득량 */
  const baseExpectation = calculateBaseCatchExpectation(input);

  /** 쌍걸이 미사용이면 기본 기대값 그대로 반환 */
  if (!input.environment.useDoubleHook || input.skills.doubleHook <= 0) {
    return baseExpectation;
  }

  /** 입력 데이터에서 주요 그룹 분리 */
  const { stats, skills, environment } = input;

  /** 갈증 최소치 평균 효율 */
  const effectiveThirstMultiplier = getEffectiveThirstMultiplier(
    environment.thirstMin,
  );

  /** 소문난 미끼 확률 보너스 */
  const rumoredBaitChancePercent = getRumoredBaitValue(skills.rumoredBait);

  /** 바닐라 결과물 확률 */
  const vanillaChancePercent = calculateVanillaChancePercent(input);

  /** 커스텀 물고기 확률 */
  const customFishChancePercent = 100 - vanillaChancePercent;

  /** 커스텀 물고기 확률 배수 */
  const customFishChanceMultiplier = customFishChancePercent / 100;

  /** 더블 캐치 확률 */
  const doubleCatchChancePercent = clamp(
    6 * effectiveThirstMultiplier +
      0.45 * stats.luck +
      rumoredBaitChancePercent,
    0,
    100,
  );

  /** 미끼가 주는 2회 낚시 확률 보너스 */
  const baitDoubleCastChancePercent =
    BAIT_EFFECTS[environment.baitType].doubleCastChanceBonusPercent;

  /** 쌍걸이 스킬이 주는 2회 낚시 확률 보너스 */
  const skillDoubleCastChancePercent =
    getDoubleHookRow(skills.doubleHook).extraCatchChancePercent;

  /** 쌍걸이 적용 기준 2회 낚시 확률 */
  const doubleCastChancePercent = clamp(
    baitDoubleCastChancePercent + skillDoubleCastChancePercent,
    0,
    100,
  );

  /** 1회 낚시당 커스텀 물고기 기대 획득량 */
  const customFishPerCatch = customFishChanceMultiplier;

  /** 더블 캐치 반영 후 1회당 커스텀 물고기 기대 획득량 */
  const finalCustomFishPerCatch =
    customFishPerCatch * (1 + doubleCatchChancePercent / 100);

  /** 1회 낚시당 전체 물고기 기대 획득량 */
  const fishPerCatch = 1 + doubleCatchChancePercent / 100;

  /** 1사이클당 낚시 시도 횟수 기대값 */
  const catchCountPerCycle = 1 + doubleCastChancePercent / 100;

  /** 1사이클당 커스텀 물고기 기대 획득량 */
  const finalCustomFishPerCycle =
    finalCustomFishPerCatch * catchCountPerCycle;

  /** 1사이클당 전체 물고기 기대 획득량 */
  const finalFishPerCycle = fishPerCatch * catchCountPerCycle;

  /** 1사이클당 커스텀 낚시 시도 기대값 */
  const expCatchCountPerCycle =
    customFishPerCatch * catchCountPerCycle;

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

/**
 * 기존 외부 호출 호환용 기대 획득량 계산 함수
 * 결과표 표시는 항상 기본 기대값 기준으로 유지한다.
 */
export function calculateCatchExpectation(
  input: FishingCalculationInput,
): CatchExpectationResult {
  return calculateBaseCatchExpectation(input);
}

/**
 * 기존 외부 호출 호환용 가치 계산 함수
 * 결과표 표시는 항상 기본 시간/기대값 기준으로 유지한다.
 */
export function calculateValue(
  input: FishingCalculationInput,
  gradeRatio: GradeRatioResult,
  catchExpectation: CatchExpectationResult,
  catchTime: CatchTimeResult,
): ValueResult {
  /** 입력 데이터에서 가격 정보 분리 */
  const { prices } = input;

  /** 물고기 1마리 기대 가치 */
  const expectedValuePerFish =
    gradeRatio.probabilityNormal * prices.normal +
    gradeRatio.probabilityAdvanced * prices.advanced +
    gradeRatio.probabilityRare * prices.rare;

  /** 1회 낚시 기준 기대 수익 */
  const expectedValuePerCycle =
    expectedValuePerFish * catchExpectation.finalCustomFishPerCycle;

  /** 시간당 낚시 횟수 */
  const cyclesPerHour =
    catchTime.totalCycleSeconds > 0 ? 3600 / catchTime.totalCycleSeconds : 0;

  /** 시간당 기대 수익 */
  const expectedValuePerHour = expectedValuePerCycle * cyclesPerHour;

  /** 바닐라 결과물 확률 */
  const vanillaChancePercent = calculateVanillaChancePercent(input);

  /** 커스텀 물고기 확률 */
  const customFishChancePercent = 100 - vanillaChancePercent;

  return {
    expectedValuePerFish: round(expectedValuePerFish),
    expectedValuePerCycle: round(expectedValuePerCycle),
    expectedValuePerHour: round(expectedValuePerHour),
    vanillaChancePercent: round(vanillaChancePercent),
    customFishChancePercent: round(customFishChancePercent),
  };
}

/**
 * 액티브 스킬 가동시간을 반영한 시간당 계산 함수
 * 결과표 추가 표시용 값과 실수익 계산값을 함께 만든다.
 */
function calculateHourlyFishingResult(
  input: FishingCalculationInput,
  gradeRatio: GradeRatioResult,
) {
  /** 기본 낚시 시간 */
  const baseCatchTime = calculateBaseCatchTime(input);

  /** 떼낚시 적용 낚시 시간 */
  const schoolFishingCatchTime = calculateSchoolFishingCatchTime(input);

  /** 기본 기대 획득량 */
  const baseExpectation = calculateBaseCatchExpectation(input);

  /** 쌍걸이 적용 기대 획득량 */
  const doubleHookExpectation = calculateDoubleHookCatchExpectation(input);

  /** 물고기 1마리 기대 가치 */
  const expectedValuePerFish =
    gradeRatio.probabilityNormal * input.prices.normal +
    gradeRatio.probabilityAdvanced * input.prices.advanced +
    gradeRatio.probabilityRare * input.prices.rare;

  /** 떼낚시 가동 정보 */
  const schoolFishingUptime =
    input.environment.useSchoolFishing && input.skills.schoolFishing > 0
      ? calculateSkillUptime(
          getSchoolFishingRow(input.skills.schoolFishing).durationSeconds,
          getSchoolFishingRow(input.skills.schoolFishing).cooldownSeconds,
        )
      : { usesPerHour: 0, activeSecondsPerHour: 0, activeRatio: 0 };

  /** 쌍걸이 가동 정보 */
  const doubleHookUptime =
    input.environment.useDoubleHook && input.skills.doubleHook > 0
      ? calculateSkillUptime(
          getDoubleHookRow(input.skills.doubleHook).durationSeconds,
          getDoubleHookRow(input.skills.doubleHook).cooldownSeconds,
        )
      : { usesPerHour: 0, activeSecondsPerHour: 0, activeRatio: 0 };

  /** 떼낚시 활성 총 시간 */
  const schoolActiveSeconds = schoolFishingUptime.activeSecondsPerHour;

  /** 떼낚시 비활성 총 시간 */
  const schoolInactiveSeconds = 3600 - schoolActiveSeconds;

  /** 떼낚시 켜진 동안의 낚시 횟수 */
  const castsDuringSchoolActive =
    schoolFishingCatchTime.totalCycleSeconds > 0
      ? schoolActiveSeconds / schoolFishingCatchTime.totalCycleSeconds
      : 0;

  /** 떼낚시 꺼진 동안의 낚시 횟수 */
  const castsDuringSchoolInactive =
    baseCatchTime.totalCycleSeconds > 0
      ? schoolInactiveSeconds / baseCatchTime.totalCycleSeconds
      : 0;

  /** 총 시간당 낚시 횟수 */
  const castsPerHour =
    castsDuringSchoolActive + castsDuringSchoolInactive;

  /** 쌍걸이 활성 비율 */
  const doubleHookActiveRatio = doubleHookUptime.activeRatio;

  /** 쌍걸이 비활성 비율 */
  const doubleHookInactiveRatio = 1 - doubleHookActiveRatio;

  /** 1사이클당 평균 커스텀 물고기 기대 획득량 */
  const expectedCustomFishPerCycle =
    baseExpectation.finalCustomFishPerCycle * doubleHookInactiveRatio +
    doubleHookExpectation.finalCustomFishPerCycle * doubleHookActiveRatio;

  /** 시간당 커스텀 물고기 획득량 */
  const customFishPerHour =
    castsPerHour * expectedCustomFishPerCycle;

  /** 1회 낚시 기대 수익 */
  const expectedValuePerCycle =
    expectedValuePerFish * expectedCustomFishPerCycle;

  /** 시간당 기대 수익 */
  const expectedValuePerHour =
    castsPerHour * expectedValuePerCycle;

  return {
    castsPerHour: round(castsPerHour),
    customFishPerHour: round(customFishPerHour),
    expectedValuePerFish: round(expectedValuePerFish),
    expectedValuePerCycle: round(expectedValuePerCycle),
    expectedValuePerHour: round(expectedValuePerHour),
    schoolFishingUsesPerHour: schoolFishingUptime.usesPerHour,
    schoolFishingActiveSecondsPerHour: round(
      schoolFishingUptime.activeSecondsPerHour,
    ),
    doubleHookUsesPerHour: doubleHookUptime.usesPerHour,
    doubleHookActiveSecondsPerHour: round(
      doubleHookUptime.activeSecondsPerHour,
    ),
  };
}

/**
 * 전체 낚시 계산 함수
 * 기존 결과 구조는 유지하고, hourly 필드만 추가한다.
 */
export function calculateFishing(input: FishingCalculationInput) {
  /** 결과표 표시용 기본 시간 */
  const catchTime = calculateCatchTime(input);

  /** 등급 비율 계산 결과 */
  const gradeRatio = calculateGradeRatio(input);

  /** 결과표 표시용 기본 기대 획득량 */
  const catchExpectation = calculateCatchExpectation(input);

  /** 결과표 표시용 기본 가치 계산 */
  const value = calculateValue(
    input,
    gradeRatio,
    catchExpectation,
    catchTime,
  );

  /** 액티브 스킬 반영 시간당 계산 결과 */
  const hourly = calculateHourlyFishingResult(input, gradeRatio);

  return {
    catchTime,
    gradeRatio,
    catchExpectation,
    value: {
      ...value,
      expectedValuePerCycle: hourly.expectedValuePerCycle,
      expectedValuePerHour: hourly.expectedValuePerHour,
    },
    hourly: {
      castsPerHour: hourly.castsPerHour,
      customFishPerHour: hourly.customFishPerHour,
      schoolFishingUsesPerHour: hourly.schoolFishingUsesPerHour,
      schoolFishingActiveSecondsPerHour:
        hourly.schoolFishingActiveSecondsPerHour,
      doubleHookUsesPerHour: hourly.doubleHookUsesPerHour,
      doubleHookActiveSecondsPerHour:
        hourly.doubleHookActiveSecondsPerHour,
    },
  };
}