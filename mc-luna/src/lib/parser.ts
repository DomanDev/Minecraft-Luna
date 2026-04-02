// src/lib/parser.ts

/**
 * 생활 정보 원문 텍스트를 파싱해서
 * 프로젝트 표준 구조(ParsedLifeProfile)로 변환하는 파일
 *
 * 이번 버전에서 반영한 핵심:
 * 1) 낚시 / 농사 / 추후 직업까지 확장 가능한 jobs + skills 구조 사용
 * 2) [숙련도] 영역의 실제 서버 형식
 *    예: "ㆍ𠀮 농사 (Lv:26 / 116,785.6 / 304,400, 38.37%)"
 *    를 파싱하도록 수정
 * 3) 농사 계산에 필요한 농사 스탯 추가 파싱
 * 4) [임시 스킬 목록]의 보주 강화 스킬 증가분(+2Lv 등)을
 *    기본 스킬 레벨에 합산
 * 5) 스킬 최대 레벨 30 적용
 */

import type {
  JobKey,
  JobProfile,
  JobSkillMap,
  ParsedLifeProfile,
  ParsedStatValue,
} from "@/src/types/life-profile";

/**
 * 서버 내 한글 직업명 -> 내부 JobKey 매핑
 *
 * 추후 새 직업이 생기면 여기 추가하면 됨
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
 * 공통 한글 라벨 정규화
 *
 * 예:
 * - "보물 감지" -> "보물감지"
 * - "일반 작물 감소비율" -> "일반작물감소비율"
 *
 * 띄어쓰기 차이 때문에 파싱 실패하는 걸 줄이기 위해 사용
 */
function normalizeKoreanLabel(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

/**
 * ParsedStatValue 생성 함수
 *
 * import 방식에서는 base / temp / equip / total이 모두 존재하므로
 * 표준 구조로 만들어 반환
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
 * jobs[jobKey]가 없으면 기본 뼈대를 만들고 반환
 *
 * 이렇게 해두면
 * jobs.fishing이 undefined인지 계속 체크할 필요가 줄어듦
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
 * skills[jobKey]가 없으면 기본 객체를 만들고 반환
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
 * 스킬 레벨은 최대 30으로 제한
 *
 * 생활 정보 원문이나 임시 스킬 합산 결과가 30을 넘더라도
 * 최종 값은 30까지만 허용
 */
function clampSkillLevel(level: number): number {
  if (Number.isNaN(level) || level < 0) return 0;
  return Math.min(30, level);
}

/**
 * 기존 스킬 레벨에 추가 레벨을 누적
 *
 * 사용 예:
 * - 기본 스킬 목록에서 풍년의 축복 Lv20 파싱
 * - 임시 스킬 목록에서 풍년의 축복 +2Lv 파싱
 * - 최종 결과 22
 */
function addSkillLevel(
  skills: Partial<Record<JobKey, JobSkillMap>>,
  jobKey: JobKey,
  skillKey: string,
  levelToAdd: number,
) {
  const skillMap = ensureSkillMap(skills, jobKey);
  const current = skillMap[skillKey] ?? 0;
  skillMap[skillKey] = clampSkillLevel(current + levelToAdd);
}

/**
 * 명성 레벨 파싱
 *
 * 예:
 * 명성: 26 (272,163.6 / 456,600, 59.61%)
 */
function parseReputationLevel(text: string): number {
  const match = text.match(/명성\s*:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * 스탯명 -> 내부 stat key 매핑
 *
 * 이번 버전에서는 농사 계산에 필요한 스탯까지 반영
 *
 * 낚시 관련:
 * - 어획량 증가율
 * - 일반 물고기 감소비율
 * - 기척 시간 감소
 *
 * 농사 관련:
 * - 일반 작물 감소비율
 * - 작물 추가 드롭률
 * - 경작지당 화분통 설치 개수
 *
 * 공통:
 * - 행운
 * - 감각
 */
const STAT_NAME_MAP: Record<string, string> = {
  "행운": "luck",
  "감각": "sense",

  "어획량증가율": "fishingYieldBonus",
  "어획량 증가율": "fishingYieldBonus",

  "일반물고기감소비율": "normalFishReduction",
  "일반 물고기 감소비율": "normalFishReduction",

  "기척시간감소": "nibbleTimeReduction",
  "기척 시간 감소": "nibbleTimeReduction",

  "일반작물감소비율": "normalCropReduction",
  "일반 작물 감소비율": "normalCropReduction",

  "작물추가드롭률": "extraCropDropRate",
  "작물 추가 드롭률": "extraCropDropRate",

  "경작지당화분통설치개수": "planterCountPerFarmland",
  "경작지당 화분통 설치 개수": "planterCountPerFarmland",
};

/**
 * 스킬명 -> 내부 job / skill key 매핑
 *
 * [스킬] / [임시 스킬 목록] 둘 다 이 매핑을 사용
 */
const SKILL_NAME_MAP: Record<string, { job: JobKey; key: string }> = {
  // 낚시
  "보물감지": { job: "fishing", key: "treasureDetection" },
  "보물 감지": { job: "fishing", key: "treasureDetection" },

  "소문난미끼": { job: "fishing", key: "famousBait" },
  "소문난 미끼": { job: "fishing", key: "famousBait" },

  "낚싯줄장력": { job: "fishing", key: "lineTension" },
  "낚싯줄 장력": { job: "fishing", key: "lineTension" },

  "쌍걸이": { job: "fishing", key: "doubleCatch" },
  "떼낚시": { job: "fishing", key: "schoolFishing" },

  // 농사
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
 * 공통 스탯(행운, 감각)은
 * 현재 계산기 구조상 낚시와 농사 양쪽에 모두 반영
 *
 * 이유:
 * - 낚시 계산기에서도 사용
 * - 농사 계산기에서도 사용
 */
const SHARED_STAT_TARGET_JOBS: JobKey[] = ["fishing", "farming"];

/**
 * 스탯 라인 파싱
 *
 * 예:
 * ㆍ행운 (base:20 / temp:93.38 / equip:0 / total:113.38)
 * ㆍ일반 작물 감소비율 (base:0 / temp:0 / equip:30.4 / total:30.4)
 * ㆍ작물 추가 드롭률 (base:0 / temp:0 / equip:16 / total:16)
 * ㆍ경작지당 화분통 설치 개수 (base:0 / temp:0 / equip:168 / total:168)
 */
function parseStats(
  text: string,
  jobs: Partial<Record<JobKey, JobProfile>>,
): void {
  const statRegex =
    /ㆍ?\s*([가-힣A-Za-z0-9\s]+)\s*\(\s*base\s*:\s*([-\d.]+)\s*\/\s*temp\s*:\s*([-\d.]+)\s*\/\s*equip\s*:\s*([-\d.]+)\s*\/\s*total\s*:\s*([-\d.]+)\s*\)/g;

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

    /**
     * 행운 / 감각은 공통 스탯이므로 낚시, 농사 둘 다 넣음
     */
    if (statKey === "luck" || statKey === "sense") {
      for (const jobKey of SHARED_STAT_TARGET_JOBS) {
        const jobProfile = ensureJobProfile(jobs, jobKey);
        jobProfile.stats[statKey] = statValue;
      }
      continue;
    }

    /**
     * 낚시 전용 스탯
     */
    if (
      statKey === "fishingYieldBonus" ||
      statKey === "normalFishReduction" ||
      statKey === "nibbleTimeReduction"
    ) {
      const fishingProfile = ensureJobProfile(jobs, "fishing");
      fishingProfile.stats[statKey] = statValue;
      continue;
    }

    /**
     * 농사 전용 스탯
     */
    if (
      statKey === "normalCropReduction" ||
      statKey === "extraCropDropRate" ||
      statKey === "planterCountPerFarmland"
    ) {
      const farmingProfile = ensureJobProfile(jobs, "farming");
      farmingProfile.stats[statKey] = statValue;
      continue;
    }
  }
}

/**
 * [숙련도] 영역 파싱
 *
 * 실제 서버 형식 예:
 * ㆍ𠀮 농사 (Lv:26 / 116,785.6 / 304,400, 38.37%)
 * ㆍ𠀰 낚시 (Lv:24 / 33,941.6 / 231,600, 14.66%)
 * ㆍ𠀞 채광 (Lv:10 / 4,817.6 / 20,000, 24.09%)
 *
 * 특징:
 * - 앞에 특수문자(𠀮 등)가 붙을 수 있음
 * - "숙련도:" 텍스트가 아니라 "(Lv:26 / ...)" 구조임
 *
 * 따라서 기존 "낚시 숙련도: 10" 전용 정규식 대신
 * 실제 형식에 맞는 정규식 사용
 */
function parseJobLevels(
  text: string,
  jobs: Partial<Record<JobKey, JobProfile>>,
): void {
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    /**
     * 대략 이런 라인을 잡기 위한 정규식:
     * - 맨 앞 bullet
     * - 중간 아무 문자(아이콘)
     * - 직업명
     * - (Lv:숫자 ...)
     */
    const match = trimmed.match(
      /^ㆍ.*?(낚시|농사|채광|요리|대장술|연금술)\s*\(Lv\s*:\s*(\d+)/,
    );

    if (!match) continue;

    const koreanJobName = match[1];
    const level = Number(match[2]);
    const jobKey = JOB_NAME_MAP[koreanJobName];

    if (!jobKey) continue;

    const jobProfile = ensureJobProfile(jobs, jobKey);
    jobProfile.level = level;
  }
}

/**
 * [스킬] 영역의 기본 스킬 레벨 파싱
 *
 * 예:
 * ㆍ수확의 손길 (Lv:5)
 * ㆍ비옥한 토양 (Lv:20)
 * ㆍ풍년의 축복 (Lv:20)
 * ㆍ개간의 서약 (Lv:20)
 *
 * 여기서 파싱한 값은 "기본 스킬 레벨"
 */
function parseBaseSkills(
  text: string,
  skills: Partial<Record<JobKey, JobSkillMap>>,
): void {
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("ㆍ")) continue;

    /**
     * 예:
     * ㆍ풍년의 축복 (Lv:20)
     * ㆍ쌍걸이 (Lv:4)
     */
    const match = trimmed.match(/^ㆍ\s*([가-힣A-Za-z\s]+)\s*\(Lv\s*:\s*(\d+)\s*\)$/);
    if (!match) continue;

    const rawSkillName = match[1].trim();
    const normalizedSkillName = normalizeKoreanLabel(rawSkillName);
    const level = Number(match[2]);

    const mapping =
      SKILL_NAME_MAP[rawSkillName] ?? SKILL_NAME_MAP[normalizedSkillName];

    if (!mapping) continue;

    /**
     * 기본 스킬 레벨은 "덮어쓰기" 개념으로 저장
     * (임시 스킬은 이후 별도 합산)
     */
    const skillMap = ensureSkillMap(skills, mapping.job);
    skillMap[mapping.key] = clampSkillLevel(level);
  }
}

/**
 * [임시 스킬 목록] 영역 파싱
 *
 * 예:
 * - 풍년의 축복 (equip:CHEST) +2Lv / 만료: 무한 [❌ 삭제]
 *
 * 여기서 중요한 건:
 * - "풍년의 축복"이라는 스킬명
 * - "+2Lv"라는 증가량
 *
 * 이 증가량을 기존 기본 스킬 레벨에 더해줘야 함
 */
function parseTemporarySkills(
  text: string,
  skills: Partial<Record<JobKey, JobSkillMap>>,
): void {
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    /**
     * [임시 스킬 목록]의 각 줄 예:
     * - 풍년의 축복 (equip:CHEST) +2Lv / 만료: 무한 [❌ 삭제]
     *
     * 포인트:
     * - 맨 앞 "-"
     * - 스킬명
     * - 중간 괄호
     * - +2Lv
     */
    const match = trimmed.match(/^-\s*([가-힣A-Za-z\s]+)\s*\(.*?\)\s*\+(\d+)Lv/);
    if (!match) continue;

    const rawSkillName = match[1].trim();
    const normalizedSkillName = normalizeKoreanLabel(rawSkillName);
    const bonusLevel = Number(match[2]);

    const mapping =
      SKILL_NAME_MAP[rawSkillName] ?? SKILL_NAME_MAP[normalizedSkillName];

    if (!mapping) continue;

    /**
     * 기본 스킬에 bonusLevel을 누적
     *
     * 예:
     * 기본: 풍년의 축복 20
     * 임시: +2
     * 결과: 22
     */
    addSkillLevel(skills, mapping.job, mapping.key, bonusLevel);
  }
}

/**
 * 최종 공개 함수
 *
 * 처리 순서:
 * 1) 명성 파싱
 * 2) 숙련도 파싱
 * 3) 스탯 파싱
 * 4) 기본 스킬 파싱
 * 5) 임시 스킬 파싱(기본 스킬에 합산)
 *
 * 반환:
 * - ParsedLifeProfile 표준 구조
 */
export function parseLifeProfile(rawText: string): ParsedLifeProfile {
  const jobs: Partial<Record<JobKey, JobProfile>> = {};
  const skills: Partial<Record<JobKey, JobSkillMap>> = {};

  parseJobLevels(rawText, jobs);
  parseStats(rawText, jobs);
  parseBaseSkills(rawText, skills);
  parseTemporarySkills(rawText, skills);

  return {
    reputationLevel: parseReputationLevel(rawText),
    jobs,
    skills,
  };
}