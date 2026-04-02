// src/types/life-profile.ts

export type JobKey =
  | "fishing"
  | "farming"
  | "mining"
  | "cooking"
  | "blacksmithing"
  | "alchemy";

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

export type ParsedLifeProfile = {
  reputationLevel: number;
  jobs: Partial<Record<JobKey, JobProfile>>;
  skills: Partial<Record<JobKey, JobSkillMap>>;
};

export type ManualStatInput = {
  total: number;
};

export type ManualJobProfileInput = {
  level: number;
  stats: Record<string, ManualStatInput>;
};

export type ManualLifeProfileInput = {
  reputationLevel: number;
  jobs: Partial<Record<JobKey, ManualJobProfileInput>>;
  skills: Partial<Record<JobKey, JobSkillMap>>;
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