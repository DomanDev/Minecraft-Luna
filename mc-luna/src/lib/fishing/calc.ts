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
 *
 * 여기 숫자들은 계산 엔진의 기준값이다.
 * 나중에 루나서버 실측 결과가 더 나오면
 * 이 상수만 수정해도 전체 계산에 반영된다.
 */
export const DEFAULT_FISHING_CONFIG: FishingCalcConfig = {
  // 루나서버 실제 표시 기본값
  baseNibbleTicks: 360,
  baseBiteTicks: 90,

  // 감각 계수
  senseNibbleCoeff: 1.2,
  senseBiteCoeff: 0.4,

  // 기본 등급 비율
  baseGradeNormal: 150,
  baseGradeAdvanced: 30,
  baseGradeRare: 15,

  // 행운 계수
  luckGradeCoeff: 1.2,

  // 바닐라 결과물 확률
  vanillaBasePercent: 20,
  vanillaLuckCoeff: 0.15,

  // 밤 보정
  nightNibbleReductionRate: 0.05,
  nightBiteReductionRate: 0.03,

  // Lure 인챈트 레벨당 100틱(=5초) 감소
  // Minecraft 기본 규칙 기준 :contentReference[oaicite:2]{index=2}
  lureEnchantReductionTicksPerLevel: 100,

  maxThirst: 100,
  averageThirst: 75,
};

/**
 * 소수점 버림 함수
 */
function floorTick(value: number): number {
  return Math.floor(value);
}

/**
 * 소수점 반올림 함수
 */
function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * 최소/최대값 제한
 */
function clamp(value: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 틱 -> 초 변환
 * 마인크래프트는 20틱 = 1초
 */
function ticksToSeconds(ticks: number): number {
  return ticks / 20;
}

/**
 * PondState에 따른 보정값 반환
 */
function getPondModifiers(pondState: PondState) {
  switch (pondState) {
    case "abundant":
      return {
        nibbleRate: -0.08, // 기척 8% 감소
        biteRate: -0.12,   // 입질 12% 감소
      };
    case "normal":
      return {
        nibbleRate: 0,
        biteRate: -0.05,   // 입질 5% 감소
      };
    case "depleted":
      return {
        nibbleRate: 0.20,  // 기척 20% 증가
        biteRate: 0.10,    // 입질 10% 증가
      };
    default:
      return {
        nibbleRate: 0,
        biteRate: 0,
      };
  }
}

/**
 * Partial config를 기본값과 합쳐서 완전한 config를 만든다.
 */
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
 * 3. 미끼 인챈트 적용 (기척만)
 * 4. 밤 보정
 * 5. 어장 보정
 * 6. 미끼 보정
 * 7. 떡밥 보정
 * 8. 떼낚시 고정 감소
 *
 * 왜 이 순서로 했는가?
 * - 감각/인챈트는 기본 대기시간을 직접 깎는 성격으로 보고 먼저 적용
 * - 밤/어장/미끼/떡밥은 % 보정이라 그 다음 적용
 * - 떼낚시는 스킬 표가 "틱 감소"로 주어졌으므로 마지막에 고정 감소
 *
 * 이 순서는 나중에 서버 실측 결과가 더 나오면 바꿀 수 있도록
 * 단계별 값을 전부 남기게 해두었다.
 */
export function calculateCatchTime(input: FishingCalculationInput): CatchTimeResult {
  const config = mergeConfig(input.config);
  const { stats, skills, environment } = input;

  const baitEffect = BAIT_EFFECTS[environment.baitType];
  const groundbaitEffect = GROUNDBAIT_EFFECTS[environment.groundbaitType];
  const pond = getPondModifiers(environment.pondState);

  // 1) 기본값
  const baseNibbleTicks = config.baseNibbleTicks;
  const baseBiteTicks = config.baseBiteTicks;

  // 2) 감각 적용
  const afterSenseNibbleTicks =
    baseNibbleTicks - config.senseNibbleCoeff * stats.sense;
  const afterSenseBiteTicks =
    baseBiteTicks - config.senseBiteCoeff * stats.sense;

  // 3) 밤 보정
  const afterNightNibbleTicks =
    environment.timeOfDay === "night"
      ? afterSenseNibbleTicks * (1 - config.nightNibbleReductionRate)
      : afterSenseNibbleTicks;

  const afterNightBiteTicks =
    environment.timeOfDay === "night"
      ? afterSenseBiteTicks * (1 - config.nightBiteReductionRate)
      : afterSenseBiteTicks;

  // 4) 어장 보정
  const afterPondNibbleTicks =
    afterNightNibbleTicks * (1 + pond.nibbleRate);
  const afterPondBiteTicks =
    afterNightBiteTicks * (1 + pond.biteRate);

  // 5) 미끼 보정
  const afterBaitNibbleTicks =
    afterPondNibbleTicks * (1 - baitEffect.nibbleReductionRate);
  const afterBaitBiteTicks =
    afterPondBiteTicks * (1 - baitEffect.biteReductionRate);

  // 6) 떡밥 보정
  const afterGroundbaitNibbleTicks =
    afterBaitNibbleTicks * (1 - groundbaitEffect.nibbleReductionRate);
  const afterGroundbaitBiteTicks =
    afterBaitBiteTicks * (1 - groundbaitEffect.biteReductionRate);

  // 7) 떼낚시 적용
  let afterSchoolFishingNibbleTicks = afterGroundbaitNibbleTicks;
  let afterSchoolFishingBiteTicks = afterGroundbaitBiteTicks;

  if (environment.useSchoolFishing && skills.schoolFishing > 0) {
    const schoolFishingRow = getSchoolFishingRow(skills.schoolFishing);

    afterSchoolFishingNibbleTicks =
      afterGroundbaitNibbleTicks - schoolFishingRow.nibbleReductionTicks;

    afterSchoolFishingBiteTicks =
      afterGroundbaitBiteTicks - schoolFishingRow.biteReductionTicks;
  }

/**
   * 여기까지가 "루나서버 상단 표시값" 기준
   * 즉, 인챈트 미적용 표시용 값
   */
  const displayNibbleTicks = floorTick(clamp(afterSchoolFishingNibbleTicks, 1));
  const displayBiteTicks = floorTick(clamp(afterSchoolFishingBiteTicks, 1));

  const displayNibbleSeconds = ticksToSeconds(displayNibbleTicks);
  const displayBiteSeconds = ticksToSeconds(displayBiteTicks);

  /**
   * 8) 미끼 인챈트 적용
   * 실제 체감 계산용 최종값
   */
  const lureReductionTicks =
    clamp(environment.lureEnchantLevel, 0, 3) *
    config.lureEnchantReductionTicksPerLevel;

  const afterLureEnchantNibbleTicks =
    displayNibbleTicks - lureReductionTicks;

  // 입질은 인챈트 미적용
  const afterLureEnchantBiteTicks = displayBiteTicks;

  // 최소 1틱 아래로는 내려가지 않도록 보호
  const finalNibbleTicks = clamp(afterLureEnchantNibbleTicks, 1);
  const finalBiteTicks = clamp(afterLureEnchantBiteTicks, 1);

  const finalNibbleSeconds = ticksToSeconds(finalNibbleTicks);
  const finalBiteSeconds = ticksToSeconds(finalBiteTicks);
  const totalCycleSeconds = finalNibbleSeconds + finalBiteSeconds;

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
    totalCycleSeconds: round(totalCycleSeconds),
  };
}

/**
 * 물고기 등급 비율 계산
 *
 * 공식:
 * 일반 = 150 - 낚싯줄 장력 감소값
 * 고급 = 30 + (1.2 * 행운) + 미끼 추가값
 * 희귀 = 15 + (1.2 * 행운) + 미끼 추가값
 *
 * 이후 전체합으로 나눠 확률화
 */
export function calculateGradeRatio(input: FishingCalculationInput): GradeRatioResult {
  const config = mergeConfig(input.config);
  const { stats, skills, environment } = input;

  const baitEffect = BAIT_EFFECTS[environment.baitType];

  const rawNormal =
    config.baseGradeNormal - getLineTensionValue(skills.lineTension);

  const rawAdvanced =
    config.baseGradeAdvanced +
    config.luckGradeCoeff * stats.luck +
    baitEffect.advancedBonus;

  const rawRare =
    config.baseGradeRare +
    config.luckGradeCoeff * stats.luck +
    baitEffect.rareBonus;

  // 혹시라도 음수가 되지 않도록 방어
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
 *
 * 공식:
 * 20 - (0.15 * 행운)
 */
export function calculateVanillaChancePercent(input: FishingCalculationInput): number {
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
 *
 * 기본 1회 낚시에 1마리
 * 소문난 미끼는 "추가 획득 확률"로 처리
 * 쌍걸이는 "추가 낚시 기대 확률"로 처리
 */
export function calculateCatchExpectation(
  input: FishingCalculationInput,
): CatchExpectationResult {
  const config = mergeConfig(input.config);
  const { skills, environment } = input;

  /**
   * 평균 갈증값
   * 실전 기준 15의 1%=75 고정
   */
  const averageThirst = config.averageThirst;

  /**
   * 갈증의 1.0%
   * 예: 갈증 15 -> 15%
   */
  const thirstPercent = averageThirst;

  /**
   * 소문난 미끼 수치 = 어획량 증가율
   */
  const rumoredBaitChancePercent = getRumoredBaitValue(skills.rumoredBait);

  /**
   * 더블 캐치 확률
   * = 6 * (갈증의 1.0%) + 어획량 증가율
   *
   * 예:
   * 갈증 15 -> 6 * 15% = 0.9
   * 소문난 미끼 20레벨 -> 18
   * 최종 = 18.9%
   */
  const doubleCatchChancePercent = clamp(
    6 * (thirstPercent / 100) + rumoredBaitChancePercent,
    0,
    100,
  );

  /**
   * 2회 낚시 확률 = 쌍걸이 확률
   * useDoubleHook가 false면 0%
   */
  const doubleCastChancePercent =
    environment.useDoubleHook && skills.doubleHook > 0
      ? getDoubleHookRow(skills.doubleHook).extraCatchChancePercent
      : 0;

  /**
   * 낚시 1회당 기대 물고기 수
   * 더블 캐치 반영
   * 예: 18.9% -> 1.189개
   */
  const fishPerCatch = 1 + doubleCatchChancePercent / 100;

  /**
   * 1회 사이클당 기대 낚시 횟수
   * 쌍걸이 반영
   * 예: 6% -> 1.06회
   */
  const catchCountPerCycle = 1 + doubleCastChancePercent / 100;

  /**
   * 최종 기대 획득량
   */
  const finalFishPerCycle = fishPerCatch * catchCountPerCycle;

  /**
   * 경험치 계산 기준
   * 더블 캐치 추가 물고기는 경험치 없음
   * 하지만 2회 낚시는 경험치 2번 획득 가능
   */
  const expCatchCountPerCycle = catchCountPerCycle;

  return {
    averageThirst: round(averageThirst),
    doubleCatchChancePercent: round(doubleCatchChancePercent),
    doubleCastChancePercent: round(doubleCastChancePercent),
    fishPerCatch: round(fishPerCatch),
    catchCountPerCycle: round(catchCountPerCycle),
    finalFishPerCycle: round(finalFishPerCycle),
    expCatchCountPerCycle: round(expCatchCountPerCycle),
  };
}

/**
 * 기대 가치 계산
 */
export function calculateValue(
  input: FishingCalculationInput,
  gradeRatio: GradeRatioResult,
  catchExpectation: CatchExpectationResult,
  catchTime: CatchTimeResult,
): ValueResult {
  const { prices } = input;

  // 물고기 1마리의 기대 가치
  const expectedValuePerFish =
    gradeRatio.probabilityNormal * prices.normal +
    gradeRatio.probabilityAdvanced * prices.advanced +
    gradeRatio.probabilityRare * prices.rare;

  // 1회 낚시 기대 수익
  const expectedValuePerCycle =
    expectedValuePerFish * catchExpectation.finalFishPerCycle;

  // 시간당 수익
  const cyclesPerHour =
    catchTime.totalCycleSeconds > 0
      ? 3600 / catchTime.totalCycleSeconds
      : 0;

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

/**
 * 전체 계산을 한번에 묶은 메인 함수
 */
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