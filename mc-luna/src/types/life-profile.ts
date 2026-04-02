// src/types/life-profile.ts

export type JobKey =
  | "fishing"
  | "farming"
  | "mining"
  | "cooking"
  | "blacksmithing"
  | "alchemy";

/**
 * 2) StatKey 확장
 *
 * 공통 기본 스탯 6개 +
 * 계산에 바로 쓰는 직업별 도감 효과 스탯
 */
export type StatKey =
  | 'luck'
  | 'sense'
  | 'endurance'
  | 'mastery'
  | 'dexterity'
  | 'charisma'
  | 'fishingYieldBonus'
  | 'normalFishReduction'
  | 'nibbleTimeReduction'
  | 'normalCropReduction'
  | 'miningDelayReduction'
  | 'miningDamageIncrease'
  | 'cookingGradeUpChance';

export type InputMethod = "imported" | "manual";

export type ParsedStatValue = {
  base: number;
  temp: number;
  equip: number;
  total: number;
};

export type JobStatMap = Record<string, ParsedStatValue>;
export type JobSkillMap = Record<string, number>;

export type JobProfile = {
  level: number;
  stats: JobStatMap;
};

/**
 * 4) 각 job의 stats는 Partial<Record<StatKey, ParsedStatValue>> 형태를 허용
 */
export type ParsedJobProfile = {
  level?: number;
  stats: Partial<Record<StatKey, ParsedStatValue>>;
};

/**
 * 5) ParsedLifeProfile 확장
 */
export type ParsedLifeProfile = {
  reputationLevel?: number;
  jobs: Partial<Record<JobKey, ParsedJobProfile>>;
  skills: Partial<Record<JobKey, Record<string, number>>>;
};

export type ManualStatInput = {
  total: number;
};

export type ManualJobProfileInput = {
  level: number;
  stats: Record<string, ManualStatInput>;
};

/**
 * 6) ManualLifeProfileInput도 같은 구조를 수용하도록 확장
 *
 * 지금 ProfilePage의 buildManualLifeProfileInput()에서
 * fishing/farming/mining/cooking 전부 넣으므로
 * jobs, skills가 넓은 key를 허용해야 함
 */
export type ManualLifeProfileInput = {
  reputationLevel?: number;
  jobs: Partial<
    Record<
      JobKey,
      {
        level?: number;
        stats: Partial<
          Record<
            StatKey,
            {
              total: number;
            }
          >
        >;
      }
    >
  >;
  skills: Partial<Record<JobKey, Record<string, number>>>;
};

export const SUPPORTED_JOB_KEYS: JobKey[] = [
  "fishing",
  "farming",
  "mining",
  "cooking",
  "blacksmithing",
  "alchemy",
];

export const JOB_LABELS: Record<JobKey, string> = {
  fishing: "낚시",
  farming: "농사",
  mining: "채광",
  cooking: "요리",
  blacksmithing: "대장술",
  alchemy: "연금술",
};

export const JOB_STAT_KEYS: Record<JobKey, string[]> = {
  fishing: [
    "luck",
    "sense",
    "fishingYieldBonus",
    "normalFishReduction",
    "nibbleTimeReduction",
  ],
  farming: [
    "luck",
    "sense",
  ],
  mining: [],
  cooking: [],
  blacksmithing: [],
  alchemy: [],
};

export const JOB_SKILL_KEYS: Record<JobKey, string[]> = {
  fishing: [
    "treasureDetection",
    "famousBait",
    "lineTension",
    "doubleCatch",
    "schoolFishing",
  ],
  farming: [
    "blessingOfHarvest",
    "fertileSoil",
    "oathOfCultivation",
    "handOfHarvest",
    "reseeding",
  ],
  mining: [],
  cooking: [],
  blacksmithing: [],
  alchemy: [],
};

export function createEmptyParsedStatValue(total = 0): ParsedStatValue {
  return {
    base: 0,
    temp: 0,
    equip: 0,
    total,
  };
}

export function normalizeManualLifeProfileInput(
  input: ManualLifeProfileInput,
): ParsedLifeProfile {
  const jobs: Partial<Record<JobKey, JobProfile>> = {};

  for (const jobKey of SUPPORTED_JOB_KEYS) {
    const job = input.jobs[jobKey];
    if (!job) continue;

    const normalizedStats: JobStatMap = {};

    for (const [statKey, statValue] of Object.entries(job.stats)) {
      normalizedStats[statKey] = createEmptyParsedStatValue(statValue.total);
    }

    jobs[jobKey] = {
      level: job.level ?? 0,
      stats: normalizedStats,
    };
  }

  return {
    reputationLevel: input.reputationLevel ?? 0,
    jobs,
    skills: input.skills ?? {},
  };
}