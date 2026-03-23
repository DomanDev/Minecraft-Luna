// src/lib/fishing/types.ts

/**
 * 물고기 등급
 * normal   = 일반
 * advanced = 고급
 * rare     = 희귀
 */
export type FishGrade = "normal" | "advanced" | "rare";

/**
 * 어장 상태
 * abundant = 풍부
 * normal   = 보통
 * depleted = 고갈
 */
export type PondState = "abundant" | "normal" | "depleted";

/**
 * 갈증 최소치
 */
export type ThirstMin = 15 | 10 | 5 | 1;

/**
 * 시간대
 * day   = 낮
 * night = 밤
 */
export type TimeOfDay = "day" | "night";

/**
 * 미끼 종류
 * none = 미사용
 * worm = 지렁이 미끼
 * meal = 어분 미끼
 * lure = 루어 미끼
 */
export type BaitType = "none" | "worm" | "meal" | "lure";

/**
 * 떡밥 종류
 * none    = 미사용
 * plain   = 평범한 떡밥
 * good    = 잘만든 떡밥
 * rainbow = 무지개 떡밥
 */
export type GroundbaitType = "none" | "plain" | "good" | "rainbow";

/**
 * 유저 스탯
 */
export interface FishingStats {
  /** 행운 */
  luck: number;
  /** 감각 */
  sense: number;
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

/**
 * 계산기 환경값
 */
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
   * 마인크래프트 기본 규칙 기준:
   * 레벨당 5초(100틱)씩 대기 시간 감소
   * -> 루나 계산기에서는 표시값(display)에는 반영하지 않고, 실제 체감용 최종 기척 시간(final)에만 반영한다.
   */
  lureEnchantLevel: number;

  /** 쌍걸이 스킬 사용 여부 */
  useDoubleHook: boolean;

  /** 떼낚시 스킬 사용 여부 */
  useSchoolFishing: boolean;
}

/**
 * 등급별 시세
 */
export interface FishPrices {
  normal: number;
  advanced: number;
  rare: number;
}

/**
 * 계산기의 설정값
 * 나중에 서버 분석 결과가 더 나오면 여기만 수정하면 됨
 */
export interface FishingCalcConfig {
  /**
   * 루나서버 표시 기본값
   * 기척 = 360틱
   * 입질 = 90틱
   */
  baseNibbleTicks: number;
  baseBiteTicks: number;

  /**
   * 감각 계수
   * 기척 = 360 - (1.2 * 감각)
   * 입질 = 90 - (0.4 * 감각)
   */
  senseNibbleCoeff: number;
  senseBiteCoeff: number;

  /**
   * 등급 비율 기본값
   */
  baseGradeNormal: number;   // 150
  baseGradeAdvanced: number; // 30
  baseGradeRare: number;     // 15

  /**
   * 행운이 고급/희귀에 미치는 계수
   * 고급 += 1.2 * 행운
   * 희귀 += 1.2 * 행운
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
   * Minecraft 기본 규칙: 5초 = 100틱 / 레벨 :contentReference[oaicite:1]{index=1}
   */
  lureEnchantReductionTicksPerLevel: number;

  //** 갈증 값 */
  maxThirst: number;     // 20 -> 100
  averageThirst: number; // 15 -> 75
}

/**
 * 미끼 효과
 */
export interface BaitEffect {
  /** 기척 시간 감소율 */
  nibbleReductionRate: number;
  /** 입질 시간 감소율 */
  biteReductionRate: number;
  /** 고급 비율 추가 */
  advancedBonus: number;
  /** 희귀 비율 추가 */
  rareBonus: number;
}

/**
 * 떡밥 효과
 */
export interface GroundbaitEffect {
  nibbleReductionRate: number;
  biteReductionRate: number;
}

/**
 * 1회 낚시 시간 계산 결과
 */
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
  totalCycleSeconds: number;
}

/**
 * 등급 비율 결과
 */
export interface GradeRatioResult {
  rawNormal: number;
  rawAdvanced: number;
  rawRare: number;

  probabilityNormal: number;
  probabilityAdvanced: number;
  probabilityRare: number;
}

/**
 * 기대 획득량 결과
 */
export interface CatchExpectationResult {
  /** 사용자가 드롭박스에서 선택한 최소 갈증값 */
  selectedThirstMin: 15 | 10 | 5 | 1;

  /**
   * 최소 갈증값 기준으로 계산한 유효 갈증 계수
   * 예:
   * 15 -> 1
   * 10 -> 0.8864...
   * 5  -> 0.7656...
   * 1  -> 0.6625
   */
  effectiveThirstMultiplier: number;

  /**
   * 더블 캐치 확률
   * = 6 * (갈증의 1.0%) + 소문난 미끼 수치
   */
  doubleCatchChancePercent: number;

  /**
   * 2회 낚시 확률
   * = 쌍걸이 스킬 수치
   */
  doubleCastChancePercent: number;

  /**
   * 낚시 1회당 기대 물고기 수
   * 더블 캐치 반영
   */
  fishPerCatch: number;
  
  /**
   * 1회 사이클당 기대 낚시 횟수
   * 쌍걸이 반영
   */
  catchCountPerCycle: number;

  /**
   * 최종 기대 획득량
   */
  finalFishPerCycle: number;

  /**
   * 경험치 계산용 기대 낚시 횟수
   * 2회 낚시는 경험치 2번 획득
   */
  expCatchCountPerCycle: number;
}

/**
 * 기대 가치 결과
 */
export interface ValueResult {
  expectedValuePerFish: number;
  expectedValuePerCycle: number;
  expectedValuePerHour: number;

  vanillaChancePercent: number;
  customFishChancePercent: number;
}

/**
 * 전체 계산 입력
 */
export interface FishingCalculationInput {
  stats: FishingStats;
  skills: FishingSkills;
  environment: FishingEnvironment;
  prices: FishPrices;

  /**
   * 기본 설정 덮어쓰기용
   * 대부분은 안 넣고 DEFAULT 사용하면 됨
   */
  config?: Partial<FishingCalcConfig>;
}

/**
 * 전체 계산 출력
 */
export interface FishingCalculationResult {
  catchTime: CatchTimeResult;
  gradeRatio: GradeRatioResult;
  catchExpectation: CatchExpectationResult;
  value: ValueResult;
}