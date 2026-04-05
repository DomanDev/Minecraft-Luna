import type {
  MiningCalculationInput,
  MiningCalculationResult,
  MiningOreType,
} from "./types";

/**
 * =========================
 * 채광 계산기 임시 계산 로직
 * =========================
 *
 * 주의:
 * - 이 파일은 "뼈대"용이다.
 * - 현재는 페이지가 동작하고, 결과 카드가 정상 렌더링되며,
 *   추후 공식만 교체하면 되도록 구조를 먼저 맞춘 상태다.
 *
 * 나중에 교체 예정 항목:
 * 1) 손재주/숙련도/스킬에 따른 실제 제련 확률 보정
 * 2) 커스텀 광물 채광 속도 공식
 * 3) 갈증 소모 상세 공식
 * 4) 벨리움 합성 기대값 공식
 */

const ORE_META: Record<
  MiningOreType,
  {
    label: string;
    spawnHeightText: string;
    baseMiningSeconds: number;
  }
> = {
  mithril: {
    label: "미스릴",
    spawnHeightText: "Y -32 ~ 32",
    baseMiningSeconds: 6.0,
  },
  argentite: {
    label: "아르젠타이트",
    spawnHeightText: "Y -48 ~ 16",
    baseMiningSeconds: 7.5,
  },
  vellium: {
    label: "벨리움",
    spawnHeightText: "Y -64 ~ 0",
    baseMiningSeconds: 9.0,
  },
};

/**
 * 허름한 화로 기본 제련 확률
 *
 * 현재 기준:
 * - 일반/은별/금별 UI로 표시하지만
 * - 내부 기본값은 위키의 커먼/언커먼/레어 80/15/5 구조를 사용
 */
const BASE_FURNACE_RATES = {
  common: 0.8,
  silver: 0.15,
  gold: 0.05,
};

const SYNTHESIS_META = {
  sturdy_vellium: {
    label: "단단한 벨리움",
    successRate: 0.73,
    craftSeconds: 60,
  },
  pure_vellium: {
    label: "순수한 벨리움",
    successRate: 0.46,
    craftSeconds: 90,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateMining(
  input: MiningCalculationInput,
): MiningCalculationResult {
  const oreMeta = ORE_META[input.environment.oreType];

  /**
   * 현재는 광맥 흐름 + 도감의 채광 딜레이 감소를 합산해
   * 표시용 시간만 먼저 줄인다.
   *
   * 실제 공식은 추후 서버 데이터에 맞춰 교체
   */
  const miningDelayReductionPercent = clamp(
    input.stats.miningDelayReduction + input.skills.veinFlow,
    0,
    95,
  );

  const finalMiningSeconds =
    oreMeta.baseMiningSeconds * (1 - miningDelayReductionPercent / 100);

  /**
   * 허름한 화로 제련:
   * 아직 손재주/기타 보정은 미적용
   * → 구조만 먼저 연결
   */
  const commonRate = BASE_FURNACE_RATES.common;
  const silverRate = BASE_FURNACE_RATES.silver;
  const goldRate = BASE_FURNACE_RATES.gold;

  /**
   * 벨리움 합성:
   * 현재는 첨부 내용 기준 성공률/시간만 반영
   * 세부 재료 기대값은 추후 추가
   */
  const synthesisMeta = SYNTHESIS_META[input.environment.recipeTier];

  const processLabel =
    input.environment.processType === "furnace"
      ? "허름한 화로"
      : "벨리움 합성";

  const actionsPerHour =
    input.environment.processType === "furnace"
      ? finalMiningSeconds > 0
        ? 3600 / finalMiningSeconds
        : 0
      : synthesisMeta.craftSeconds > 0
        ? 3600 / synthesisMeta.craftSeconds
        : 0;

  const expectedValuePerAction =
    input.environment.processType === "furnace"
      ? commonRate * input.prices.common +
        silverRate * input.prices.silver +
        goldRate * input.prices.gold
      : synthesisMeta.successRate *
        (input.environment.recipeTier === "sturdy_vellium"
          ? input.prices.sturdyVellium
          : input.prices.pureVellium);

  return {
    meta: {
      oreName: oreMeta.label,
      spawnHeightText: oreMeta.spawnHeightText,
      processLabel,
    },

    mining: {
      baseMiningSeconds: oreMeta.baseMiningSeconds,
      miningDelayReductionPercent,
      finalMiningSeconds,
    },

    smelting: {
      commonRate,
      silverRate,
      goldRate,
    },

    synthesis: {
      successRate: synthesisMeta.successRate,
      craftSeconds: synthesisMeta.craftSeconds,
      outputLabel: synthesisMeta.label,
    },

    yield: {
      /**
       * 현재는 1행동당 기대 결과물 1개 기준 구조만 유지
       * 추후 광맥 감각/추가드롭/합성 재료 기대값 반영 예정
       */
      expectedOutputPerAction:
        input.environment.processType === "furnace"
          ? 1
          : synthesisMeta.successRate,
      actionsPerHour,
    },

    value: {
      expectedValuePerAction,
      expectedValuePerHour: expectedValuePerAction * actionsPerHour,
    },

    notes: [
      "현재는 채광 페이지 뼈대 구현 단계입니다.",
      "허름한 화로 등급 확률은 공개된 기본값(80/15/5)만 반영했습니다.",
      "손재주, 추가 드롭, 갈증, 벨리움 합성의 세부 공식은 추후 반영 예정입니다.",
    ],
  };
}