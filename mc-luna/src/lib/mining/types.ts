/**
 * =========================
 * 채광 계산기 타입 정의
 * =========================
 *
 * 현재 단계 목표:
 * - 페이지/계산 구조를 먼저 안정적으로 만든다.
 * - 실제 기대값 공식은 추후 상세 데이터 확보 후 보강한다.
 */

export type MiningOreType = "mithril" | "argentite" | "vellium";

export type MiningProcessType = "furnace" | "vellium_synthesis";

export type MiningRecipeTier = "sturdy_vellium" | "pure_vellium";

export type MiningThirstMin = 15 | 10 | 5 | 1 | 0;

export type MiningCalculationInput = {
  stats: {
    luck: number;
    sense: number;
    endurance: number;
    mastery: number;
    dexterity: number;
    charisma: number;

    /**
     * 도감 효과
     * - 프로필 자동 반영 대상
     */
    miningDelayReduction: number;
    miningDamageIncrease: number;
  };

  skills: {
    temperedPickaxe: number;
    veinSense: number;
    veinFlow: number;
    veinDetection: number;
    explosiveMining: number;
  };

  environment: {
    oreType: MiningOreType;
    processType: MiningProcessType;
    recipeTier: MiningRecipeTier;
    thirstMin: MiningThirstMin;
  };

  prices: {
    common: number;
    silver: number;
    gold: number;
    sturdyVellium: number;
    pureVellium: number;
  };
};

export type MiningCalculationResult = {
  meta: {
    oreName: string;
    spawnHeightText: string;
    processLabel: string;
  };

  mining: {
    /**
     * 1회 채광 기준 플레이스홀더 시간
     * - 실제 공식은 추후 서버 데이터 반영
     */
    baseMiningSeconds: number;
    miningDelayReductionPercent: number;
    finalMiningSeconds: number;
  };

  smelting: {
    /**
     * 허름한 화로 제련 기준
     * - 현재는 위키의 공개 확률을 기본값으로 사용
     * - 세부 보정 공식은 추후 연결
     */
    commonRate: number;
    silverRate: number;
    goldRate: number;
  };

  synthesis: {
    successRate: number;
    craftSeconds: number;
    outputLabel: string;
  };

  yield: {
    /**
     * 현재는 구조용 기대값
     * - 상세 공식은 추후 교체 예정
     */
    expectedOutputPerAction: number;
    actionsPerHour: number;
  };

  value: {
    expectedValuePerAction: number;
    expectedValuePerHour: number;
  };

  notes: string[];
};