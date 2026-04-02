// src/lib/parser.ts

/**
 * 생활 정보 원문 텍스트를 파싱해서
 * 프로젝트의 표준 프로필 구조(ParsedLifeProfile)로 변환하는 파일
 *
 * 이번 구조의 핵심:
 * - 낚시 / 농사 / 추후 채광 / 요리 / 대장술 / 연금술까지 확장 가능
 * - 결과는 항상 jobs + skills 구조로 반환
 */

import type {
  JobKey,
  JobProfile,
  JobSkillMap,
  ParsedLifeProfile,
  ParsedStatValue,
} from "@/src/types/life-profile";

/**
 * 서버 생활 정보 텍스트에 등장하는 "직업명" → 내부 JobKey 매핑
 *
 * 예:
 * - 낚시 숙련도 -> fishing
 * - 농사 숙련도 -> farming
 *
 * 추후 서버에 새 직업이 생기면 여기만 추가하면 됨
 */
const JOB_NAME_MAP: Record<string, JobKey> = {
  낚시: "fishing",
  농사: "farming",
  채광: "mining",
  요리: "cooking",
  대장술: "blacksmithing",
  연금술: "alchemy",
};

/**
 * 스탯명 → 어느 직업의 어떤 stat key로 넣을지 정의
 *
 * 주의:
 * 지금 생활 정보 텍스트에서 "행운", "감각"은 여러 직업 공통으로 쓰일 수 있음.
 * 하지만 현재 루나 서버 계산기 기준으로는
 * 낚시 / 농사에서 공통 활용할 예정이므로 둘 다에 넣어도 되고,
 * 일단 현재 계산에 필요한 범위만 우선 넣어도 됨.
 *
 * 여기서는 낚시 / 농사에 우선 반영하는 방식으로 작성.
 */
const SHARED_STAT_TARGET_JOBS: JobKey[] = ["fishing", "farming"];

/**
 * 생활 정보 원문에 나오는 스탯명과
 * 내부 stats key를 연결하는 매핑
 */
const STAT_NAME_MAP: Record<string, string> = {
  "행운": "luck",
  "감각": "sense",
  "어획량증가": "fishingYieldBonus",
  "어획량 증가": "fishingYieldBonus",
  "일반물고기감소비율": "normalFishReduction",
  "일반 물고기 감소비율": "normalFishReduction",
  "기척시간감소": "nibbleTimeReduction",
  "기척 시간 감소": "nibbleTimeReduction",
};

/**
 * 스킬명 → 내부 job / skill key 매핑
 *
 * 현재는 낚시 / 농사 위주로 먼저 등록
 * 추후 채광, 요리, 대장술, 연금술 스킬이 확인되면 여기 추가
 */
const SKILL_NAME_MAP: Record<
  string,
  { job: JobKey; key: string }
> = {
  // 낚시 스킬
  "보물감지": { job: "fishing", key: "treasureDetection" },
  "보물 감지": { job: "fishing", key: "treasureDetection" },

  "소문난미끼": { job: "fishing", key: "famousBait" },
  "소문난 미끼": { job: "fishing", key: "famousBait" },

  "낚싯줄장력": { job: "fishing", key: "lineTension" },
  "낚싯줄 장력": { job: "fishing", key: "lineTension" },

  "쌍걸이": { job: "fishing", key: "doubleCatch" },
  "떼낚시": { job: "fishing", key: "schoolFishing" },

  // 농사 스킬
  "풍년의축복": { job: "farming", key: "blessingOfHarvest" },
  "풍년의 축복": { job: "farming", key: "blessingOfHarvest" },

  "비옥한토양": { job: "farming", key: "fertileSoil" },
  "비옥한 토양": { job: "farming", key: "fertileSoil" },

  "개간의서약": { job: "farming", key: "oathOfCultivation" },
  "개간의 서약": { job: "farming", key: "oathOfCultivation" },

  "수확의손길": { job: "farming", key: "handOfHarvest" },
  "수확의 손길": { job: "farming", key: "handOfHarvest" },

  "되뿌리기": { job: "farming", key: "reseeding" },
};

/**
 * 한글 텍스트 비교를 편하게 하기 위해
 * 공백 제거 버전도 함께 처리할 때 사용하는 보조 함수
 */
function normalizeKoreanLabel(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

/**
 * base / temp / equip / total 구조를 만드는 공통 함수
 *
 * import 방식에서는 원문에 각 값이 다 들어 있으므로
 * 여기서 그대로 ParsedStatValue 형태로 통일
 */
function createParsedStatValue(
  base = 0,
  temp = 0,
  equip = 0,
  total = 0,
): ParsedStatValue {
  return {
    base,
    temp,
    equip,
    total,
  };
}

/**
 * 특정 job이 없으면 기본 뼈대를 만들고 반환
 *
 * 이 함수를 써두면
 * jobs.fishing이 undefined인지 매번 체크하지 않아도 됨
 */
function ensureJobProfile(
  jobs: Partial<Record<JobKey, JobProfile>>,
  jobKey: JobKey,
): JobProfile {
  if (!jobs[jobKey]) {
    jobs[jobKey] = {
      level: 0,
      stats: {},
    };
  }

  return jobs[jobKey] as JobProfile;
}

/**
 * 특정 job의 skill map이 없으면 기본 객체를 만들고 반환
 */
function ensureSkillMap(
  skills: Partial<Record<JobKey, JobSkillMap>>,
  jobKey: JobKey,
): JobSkillMap {
  if (!skills[jobKey]) {
    skills[jobKey] = {};
  }

  return skills[jobKey] as JobSkillMap;
}

/**
 * "명성: 13" 같은 라인에서 숫자 추출
 */
function parseReputationLevel(text: string): number {
  const match = text.match(/명성\s*:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * "낚시 숙련도: 21" / "농사 숙련도: 8" 같은 형식 파싱
 *
 * 서버 원문 형식이 바뀔 수 있으므로,
 * "직업명 + 숙련도" 패턴을 최대한 넓게 잡음
 */
function parseJobLevels(
  text: string,
  jobs: Partial<Record<JobKey, JobProfile>>,
): void {
  const levelRegex = /ㆍ?\s*(낚시|농사|채광|요리|대장술|연금술)\s*숙련도\s*:\s*(\d+)/g;

  for (const match of text.matchAll(levelRegex)) {
    const koreanJobName = match[1];
    const level = Number(match[2]);
    const jobKey = JOB_NAME_MAP[koreanJobName];

    if (!jobKey) continue;

    const jobProfile = ensureJobProfile(jobs, jobKey);
    jobProfile.level = level;
  }
}

/**
 * 스탯 라인 파싱
 *
 * 예시:
 * ㆍ행운 (base:22 / temp:0.7 / equip:0 / total:22.7)
 *
 * 현재 목표:
 * - 행운 / 감각은 fishing, farming 양쪽에 공통 반영 가능
 * - 어획량 증가, 일반 물고기 감소, 기척 시간 감소는 fishing 전용
 */
function parseStats(
  text: string,
  jobs: Partial<Record<JobKey, JobProfile>>,
): void {
  const statRegex =
    /ㆍ?\s*([가-힣A-Za-z\s]+)\s*\(\s*base\s*:\s*([-\d.]+)\s*\/\s*temp\s*:\s*([-\d.]+)\s*\/\s*equip\s*:\s*([-\d.]+)\s*\/\s*total\s*:\s*([-\d.]+)\s*\)/g;

  for (const match of text.matchAll(statRegex)) {
    const rawLabel = match[1].trim();
    const normalizedLabel = normalizeKoreanLabel(rawLabel);

    const base = Number(match[2]);
    const temp = Number(match[3]);
    const equip = Number(match[4]);
    const total = Number(match[5]);

    const statKey =
      STAT_NAME_MAP[rawLabel] ?? STAT_NAME_MAP[normalizedLabel];

    if (!statKey) continue;

    const statValue = createParsedStatValue(base, temp, equip, total);

    // 공통 스탯(행운, 감각)은 낚시/농사 둘 다 넣어줌
    if (statKey === "luck" || statKey === "sense") {
      for (const jobKey of SHARED_STAT_TARGET_JOBS) {
        const jobProfile = ensureJobProfile(jobs, jobKey);
        jobProfile.stats[statKey] = statValue;
      }
      continue;
    }

    // 아래는 현재 낚시 전용 스탯
    const fishingProfile = ensureJobProfile(jobs, "fishing");
    fishingProfile.stats[statKey] = statValue;
  }
}

/**
 * 스킬 라인 파싱
 *
 * 예시 형식은 서버 원문에 따라 다를 수 있어서
 * 아래 2가지 정도를 최대한 넓게 허용:
 * - ㆍ보물 감지 Lv.3
 * - ㆍ보물 감지: 3
 * - ㆍ보물 감지 3
 */
function parseSkills(
  text: string,
  skills: Partial<Record<JobKey, JobSkillMap>>,
): void {
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("ㆍ")) continue;

    // 여러 형식을 폭넓게 처리
    const match =
      trimmed.match(/^ㆍ\s*([가-힣A-Za-z\s]+?)\s*(?:Lv\.?\s*)?[: ]?\s*(\d+)\s*$/) ??
      trimmed.match(/^ㆍ\s*([가-힣A-Za-z\s]+?)\s*[:]\s*(\d+)\s*$/);

    if (!match) continue;

    const rawSkillName = match[1].trim();
    const normalizedSkillName = normalizeKoreanLabel(rawSkillName);
    const level = Number(match[2]);

    const mapping =
      SKILL_NAME_MAP[rawSkillName] ?? SKILL_NAME_MAP[normalizedSkillName];

    if (!mapping) continue;

    const skillMap = ensureSkillMap(skills, mapping.job);
    skillMap[mapping.key] = level;
  }
}

/**
 * 최종 공개 함수
 *
 * 역할:
 * - 생활 정보 원문 텍스트를 받아
 * - 프로젝트 표준 구조 ParsedLifeProfile로 반환
 */
export function parseLifeProfile(rawText: string): ParsedLifeProfile {
  const jobs: Partial<Record<JobKey, JobProfile>> = {};
  const skills: Partial<Record<JobKey, JobSkillMap>> = {};

  parseJobLevels(rawText, jobs);
  parseStats(rawText, jobs);
  parseSkills(rawText, skills);

  return {
    reputationLevel: parseReputationLevel(rawText),
    jobs,
    skills,
  };
}