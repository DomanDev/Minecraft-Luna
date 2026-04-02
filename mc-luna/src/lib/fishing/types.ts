// src/lib/fishing/types.ts

/**
 * 물고기 등급
 */
export type FishGrade = "normal" | "advanced" | "rare";

/**
 * 어장 상태
 */
export type PondState = "abundant" | "normal" | "depleted";

/** 갈증 최소치 */
export type ThirstMin = 15 | 10 | 5 | 1;

/**
 * 시간대
 */
export type TimeOfDay = "day" | "night";

/**
 * 미끼 종류
 */
export type BaitType = "none" | "worm" | "meal" | "lure";

/**
 * 떡밥 종류
 */
export type GroundbaitType = "none" | "plain" | "good" | "rainbow";

/** 유저 스탯 */
export interface FishingStats {
  /** 행운 */
  luck: number;

  /** 감각 */
  sense: number;

  /**
   * 일반 물고기 감소비율
   * - 도감 효과
   * - 일반 등급 가중치에서 추가 차감
   */
  normalFishReduction: number;

  /**
   * 기척 시간 감소
   * - 도감 효과
   * - 감각으로 줄어든 뒤 추가로 차감
   */
  nibbleTimeReduction: number;
}

/**
 * 낚시 스킬
 * 보물 감지는 현재 계산기에서 제외
 */
export interface FishingSkills {
  /** 소문난 미끼 */
  rumoredBait: number;

  /** 낚싯줄 장력 */
  lineTension: number;

  /** 쌍걸이 */
  doubleHook: number;

  /** 떼낚시 */
  schoolFishing: number;
}

/** 계산기 환경값 */
export interface FishingEnvironment {
  /** 주스를 마시기 전까지 허용하는 최소 갈증값 */
  thirstMin: ThirstMin;

  /** 낮 / 밤 */
  timeOfDay: TimeOfDay;

  /** 어장 상태 */
  pondState: PondState;

  /** 미끼 종류 */
  baitType: BaitType;

  /** 떡밥 종류 */
  groundbaitType: GroundbaitType;

  /**
   * 낚싯대 미끼 인챈트 레벨 (Lure)
   * 0 ~ 3
   */
  lureEnchantLevel: number;

  /** 쌍걸이 스킬 사용 여부 */
  useDoubleHook: boolean;

  /** 떼낚시 스킬 사용 여부 */
  useSchoolFishing: boolean;
}

/** 등급별 시세 */
export interface FishPrices {
  normal: number;
  advanced: number;
  rare: number;
}

/**
 * 계산기의 설정값
 */
export interface FishingCalcConfig {
  /** 루나서버 표시 기본값 */
  baseNibbleTicks: number;
  baseBiteTicks: number;

  /** 낚싯대 던지는 시간 */
  castStartSeconds: number;

  /** 물고기 물고 난 뒤 건져올리는 시간 */
  reelInSeconds: number;

  /**
   * 감각 계수
   * 기척 = 360 - (1.2 * 감각)
   * 입질 = 90 - (0.4 * 감각)
   */
  senseNibbleCoeff: number;
  senseBiteCoeff: number;

  /** 등급 비율 기본값 */
  baseGradeNormal: number;
  baseGradeAdvanced: number;
  baseGradeRare: number;

  /**
   * 행운이 고급/희귀에 미치는 계수
   */
  luckGradeCoeff: number;

  /**
   * 바닐라 결과물 확률
   * 기본 20 - (0.15 * 행운)
   */
  vanillaBasePercent: number;
  vanillaLuckCoeff: number;

  /**
   * 밤 보정
   * 기척 5% 감소
   * 입질 3% 감소
   */
  nightNibbleReductionRate: number;
  nightBiteReductionRate: number;

  /**
   * 미끼 인챈트(Lure) 레벨당 기척 감소 틱
   * 100틱 = 5초
   */
  lureEnchantReductionTicksPerLevel: number;

  /** 갈증 값 */
  maxThirst: number;
  averageThirst: number;
}

/** 미끼 효과 */
export interface BaitEffect {
  /** 기척 시간 감소율 */
  nibbleReductionRate: number;

  /** 입질 시간 감소율 */
  biteReductionRate: number;

  /** 고급 비율 추가 */
  advancedBonus: number;

  /** 희귀 비율 추가 */
  rareBonus: number;

  /** 미끼 자체가 주는 2회 낚시 확률 보너스 */
  doubleCastChanceBonusPercent: number;
}

/** 떡밥 효과 */
export interface GroundbaitEffect {
  nibbleReductionRate: number;
  biteReductionRate: number;
}

/** 1회 낚시 시간 계산 결과 */
export interface CatchTimeResult {
  baseNibbleTicks: number;
  baseBiteTicks: number;
  afterSenseNibbleTicks: number;
  afterSenseBiteTicks: number;

  /** 루나서버 상단 표시 기준 (인챈트 미적용) */
  displayNibbleTicks: number;
  displayBiteTicks: number;
  displayNibbleSeconds: number;
  displayBiteSeconds: number;

  /** 미끼 인챈트 적용 후 */
  afterLureEnchantNibbleTicks: number;
  afterLureEnchantBiteTicks: number;

  /** 밤 적용 후 */
  afterNightNibbleTicks: number;
  afterNightBiteTicks: number;

  /** 어장 적용 후 */
  afterPondNibbleTicks: number;
  afterPondBiteTicks: number;

  /** 미끼 적용 후 */
  afterBaitNibbleTicks: number;
  afterBaitBiteTicks: number;

  /** 떡밥 적용 후 */
  afterGroundbaitNibbleTicks: number;
  afterGroundbaitBiteTicks: number;

  /** 떼낚시 적용 후 */
  afterSchoolFishingNibbleTicks: number;
  afterSchoolFishingBiteTicks: number;

  finalNibbleTicks: number;
  finalBiteTicks: number;
  finalNibbleSeconds: number;
  finalBiteSeconds: number;

  waitSeconds: number;
  totalCycleSeconds: number;
}

/** 등급 비율 결과 */
export interface GradeRatioResult {
  rawNormal: number;
  rawAdvanced: number;
  rawRare: number;
  probabilityNormal: number;
  probabilityAdvanced: number;
  probabilityRare: number;
}

/** 기대 획득량 결과 */
export interface CatchExpectationResult {
  selectedThirstMin: ThirstMin;
  effectiveThirstMultiplier: number;
  customFishChancePercent: number;
  doubleCatchChancePercent: number;
  doubleCastChancePercent: number;
  customFishPerCatch: number;
  finalCustomFishPerCatch: number;
  fishPerCatch: number;
  catchCountPerCycle: number;
  finalCustomFishPerCycle: number;
  finalFishPerCycle: number;
  expCatchCountPerCycle: number;
}

/** 기대 가치 결과 */
export interface ValueResult {
  expectedValuePerFish: number;
  expectedValuePerCycle: number;
  expectedValuePerHour: number;
  vanillaChancePercent: number;
  customFishChancePercent: number;
}

/** 전체 입력 */
export interface FishingCalculationInput {
  stats: FishingStats;
  skills: FishingSkills;
  environment: FishingEnvironment;
  prices: FishPrices;
  config?: Partial<FishingCalcConfig>;
}

/** 전체 출력 */
export interface FishingCalculationResult {
  catchTime: CatchTimeResult;
  gradeRatio: GradeRatioResult;
  catchExpectation: CatchExpectationResult;
  value: ValueResult;
}