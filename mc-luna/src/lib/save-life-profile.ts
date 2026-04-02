// src/lib/save-life-profile.ts

import { supabase } from "@/src/lib/supabase";
import { parseLifeProfile } from "@/src/lib/parser";
import {
  type JobKey,
  type ManualLifeProfileInput,
  type ParsedLifeProfile,
  normalizeManualLifeProfileInput,
} from "@/src/types/life-profile";

/**
 * 프로필 입력 방식 구분
 *
 * imported:
 * - ./생활 정보 원문 텍스트를 붙여넣어서 저장한 경우
 *
 * manual:
 * - 프로필 페이지에서 직접 입력 폼으로 저장한 경우
 */
export type SaveLifeProfileInputMethod = "imported" | "manual";

/**
 * 숫자 안전 변환 함수
 *
 * 이유:
 * - undefined / null / NaN 값이 DB에 그대로 들어가면 에러나 예상치 못한 값이 생길 수 있음
 * - 숫자 필드는 항상 number로 맞춘 뒤 저장하는 것이 안전함
 */
function toSafeNumber(value: number | undefined | null): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

/**
 * 낚시 프로필 row 생성
 *
 * 역할:
 * - ParsedLifeProfile 내부의 jobs.fishing 데이터를
 *   fishing_profiles 테이블 row 형태로 변환
 *
 * 주의:
 * - 이 함수는 "DB 컬럼 구조"에 맞춰서 값을 펴서(flatten) 만드는 함수
 * - DB 컬럼명이 바뀌면 이 함수도 같이 수정해야 함
 */
function buildFishingProfileRow(userId: string, parsed: ParsedLifeProfile) {
  const fishingJob = parsed.jobs.fishing;
  const fishingStats = fishingJob?.stats ?? {};

  return {
    user_id: userId,
    level: toSafeNumber(fishingJob?.level),

    luck_base: toSafeNumber(fishingStats.luck?.base),
    luck_temp: toSafeNumber(fishingStats.luck?.temp),
    luck_equip: toSafeNumber(fishingStats.luck?.equip),
    luck_total: toSafeNumber(fishingStats.luck?.total),

    sense_base: toSafeNumber(fishingStats.sense?.base),
    sense_temp: toSafeNumber(fishingStats.sense?.temp),
    sense_equip: toSafeNumber(fishingStats.sense?.equip),
    sense_total: toSafeNumber(fishingStats.sense?.total),

    fishing_yield_bonus_base: toSafeNumber(fishingStats.fishingYieldBonus?.base),
    fishing_yield_bonus_temp: toSafeNumber(fishingStats.fishingYieldBonus?.temp),
    fishing_yield_bonus_equip: toSafeNumber(fishingStats.fishingYieldBonus?.equip),
    fishing_yield_bonus_total: toSafeNumber(fishingStats.fishingYieldBonus?.total),

    normal_fish_reduction_base: toSafeNumber(fishingStats.normalFishReduction?.base),
    normal_fish_reduction_temp: toSafeNumber(fishingStats.normalFishReduction?.temp),
    normal_fish_reduction_equip: toSafeNumber(fishingStats.normalFishReduction?.equip),
    normal_fish_reduction_total: toSafeNumber(fishingStats.normalFishReduction?.total),

    nibble_time_reduction_base: toSafeNumber(fishingStats.nibbleTimeReduction?.base),
    nibble_time_reduction_temp: toSafeNumber(fishingStats.nibbleTimeReduction?.temp),
    nibble_time_reduction_equip: toSafeNumber(fishingStats.nibbleTimeReduction?.equip),
    nibble_time_reduction_total: toSafeNumber(fishingStats.nibbleTimeReduction?.total),

    updated_at: new Date().toISOString(),
  };
}

/**
 * 농사 프로필 row 생성
 *
 * 역할:
 * - ParsedLifeProfile 내부의 jobs.farming 데이터를
 *   farming_profiles 테이블 row 형태로 변환
 */
function buildFarmingProfileRow(userId: string, parsed: ParsedLifeProfile) {
  const farmingJob = parsed.jobs.farming;
  const farmingStats = farmingJob?.stats ?? {};

  return {
    user_id: userId,
    level: toSafeNumber(farmingJob?.level),

    luck_base: toSafeNumber(farmingStats.luck?.base),
    luck_temp: toSafeNumber(farmingStats.luck?.temp),
    luck_equip: toSafeNumber(farmingStats.luck?.equip),
    luck_total: toSafeNumber(farmingStats.luck?.total),

    sense_base: toSafeNumber(farmingStats.sense?.base),
    sense_temp: toSafeNumber(farmingStats.sense?.temp),
    sense_equip: toSafeNumber(farmingStats.sense?.equip),
    sense_total: toSafeNumber(farmingStats.sense?.total),

    updated_at: new Date().toISOString(),
  };
}

/**
 * parser 내부 영문 skill key -> DB의 skill_name_ko 매핑
 *
 * 주의:
 * - skill_definitions.skill_name_ko 값과 정확히 일치해야 함
 */
const SKILL_KEY_TO_KOREAN_NAME: Record<string, string> = {
  // 낚시
  treasureDetection: "보물 감지",
  famousBait: "소문난 미끼",
  lineTension: "낚싯줄 장력",
  doubleCatch: "쌍걸이",
  schoolFishing: "떼낚시",

  // 농사
  blessingOfHarvest: "풍년의 축복",
  fertileSoil: "비옥한 토양",
  oathOfCultivation: "개간의 서약",
  handOfHarvest: "수확의 손길",
  reseeding: "되뿌리기",

  // 채광
  temperedPickaxe: '단련된 곡괭이',
  veinSense: '광맥 감각',
  veinFlow: '광맥 흐름',
  veinDetection: '광맥 탐지',
  explosiveMining: '폭발적인 채광',

  // 요리
  preparationMaster: '손질 달인',
  balanceOfTaste: '맛의 균형',
  gourmet: '미식가',
  instantCompletion: '즉시 완성',
  banquetPreparation: '연회 준비',
};

/**
 * 내부 JobKey -> skill_definitions.job_code 매핑
 */
const JOB_KEY_TO_DB_JOB_CODE: Record<JobKey, string> = {
  fishing: "fishing",
  farming: "farming",
  mining: "mining",
  cooking: "cooking",
  blacksmithing: "blacksmithing",
  alchemy: "alchemy",
};

/**
 * life_profile_imports 저장 row 생성
 */
function buildImportHistoryRow(params: {
  userId: string;
  parsed: ParsedLifeProfile;
  inputMethod: SaveLifeProfileInputMethod;
  rawText?: string | null;
}) {
  return {
    user_id: params.userId,
    raw_text:
      params.inputMethod === "manual" ? "[manual input]" : (params.rawText ?? ""),
    parsed_json: params.parsed,
    input_method: params.inputMethod,
  };
}

/**
 * ParsedLifeProfile 안에 실제로 존재하는 job key만 추출
 *
 * 예:
 * - jobs.fishing 이 있으면 "fishing" 포함
 * - jobs.farming 이 있으면 "farming" 포함
 */
function getParsedJobKeys(parsed: ParsedLifeProfile): JobKey[] {
  return (Object.entries(parsed.jobs) as Array<[JobKey, ParsedLifeProfile["jobs"][JobKey]]>)
    .filter(([, jobValue]) => Boolean(jobValue))
    .map(([jobKey]) => jobKey);
}

/**
 * user_skill_levels에 넣을 row 목록 생성
 *
 * 이번 수정의 핵심:
 * - imported 저장일 때는 "파싱된 직업"의 모든 추적 스킬을 기준으로 row를 만든다.
 * - 이번 텍스트에 없는 스킬은 0으로 저장한다.
 *
 * 왜 이렇게 바꾸는가?
 * - 기존 코드는 "이번에 파싱된 스킬만 upsert" 했기 때문에
 *   이전에 저장된 스킬값이 그대로 남는 문제가 있었다.
 * - 붙여넣기(import)는 사실상 '현재 상태 스냅샷'이므로
 *   파싱된 직업에 대해서는 누락된 스킬도 0으로 덮어써야 자연스럽다.
 */
async function buildSkillRowsFromDefinitions(
  userId: string,
  parsed: ParsedLifeProfile,
  options?: {
    zeroFillMissingForParsedJobs?: boolean;
  },
) {
  const zeroFillMissingForParsedJobs = options?.zeroFillMissingForParsedJobs ?? false;

  const rows: Array<{
    user_id: string;
    skill_id: string;
    skill_level: number;
    updated_at: string;
  }> = [];

  const parsedJobKeys = getParsedJobKeys(parsed);

  if (parsedJobKeys.length === 0) {
    return rows;
  }

  /**
   * 파싱된 job key를 DB job_code로 변환
   */
  const dbJobCodes = parsedJobKeys
    .map((jobKey) => JOB_KEY_TO_DB_JOB_CODE[jobKey])
    .filter(Boolean);

  if (dbJobCodes.length === 0) {
    return rows;
  }

  /**
   * 파싱된 직업 전체의 skill_definitions를 한 번에 조회
   *
   * 예:
   * - 이번 텍스트가 낚시/농사 정보를 포함하면
   *   fishing, farming의 정의를 모두 가져옴
   */
  const { data: allDefinitions, error: definitionsError } = await supabase
    .from("skill_definitions")
    .select("id, skill_name_ko, job_code")
    .in("job_code", dbJobCodes);

  if (definitionsError) {
    throw new Error(`skill_definitions 전체 조회 실패: ${definitionsError.message}`);
  }

  const definitionList = allDefinitions ?? [];

  /**
   * (job_code + skill_name_ko) 조합으로 빠르게 찾기 위한 맵
   */
  const definitionMap = new Map(
    definitionList.map((definition) => [
      `${definition.job_code}::${definition.skill_name_ko}`,
      definition,
    ]),
  );

  /**
   * 1) imported 저장일 때:
   *    파싱된 직업에 속한 모든 정의를 일단 0으로 row 생성
   *
   * 이렇게 해야 이번 텍스트에 없는 스킬도 0으로 덮어쓸 수 있다.
   */
  if (zeroFillMissingForParsedJobs) {
    for (const definition of definitionList) {
      rows.push({
        user_id: userId,
        skill_id: definition.id,
        skill_level: 0,
        updated_at: new Date().toISOString(),
      });
    }
  }

  /**
   * 2) 실제 parsed된 스킬 값으로 덮어쓰기
   *
   * - zeroFillMissingForParsedJobs = true 이면
   *   이미 들어간 0 row를 실제 레벨 값으로 교체
   *
   * - false 이면
   *   기존 방식처럼 "실제로 있는 스킬만" row 생성
   */
  const rowIndexBySkillId = new Map<string, number>(
    rows.map((row, index) => [row.skill_id, index]),
  );

  for (const [jobKey, skillMap] of Object.entries(parsed.skills)) {
    if (!skillMap) continue;

    const dbJobCode = JOB_KEY_TO_DB_JOB_CODE[jobKey as JobKey];
    if (!dbJobCode) continue;

    for (const [skillKey, level] of Object.entries(skillMap)) {
      const koreanSkillName = SKILL_KEY_TO_KOREAN_NAME[skillKey];
      if (!koreanSkillName) continue;

      const definition = definitionMap.get(`${dbJobCode}::${koreanSkillName}`);

      if (!definition) {
        console.warn(
          `[save-life-profile] skill_definitions에 없는 스킬이라 건너뜀: ${jobKey} / ${skillKey} / ${koreanSkillName}`,
        );
        continue;
      }

      const existingIndex = rowIndexBySkillId.get(definition.id);

      if (existingIndex != null) {
        rows[existingIndex] = {
          ...rows[existingIndex],
          skill_level: toSafeNumber(level),
          updated_at: new Date().toISOString(),
        };
      } else {
        rows.push({
          user_id: userId,
          skill_id: definition.id,
          skill_level: toSafeNumber(level),
          updated_at: new Date().toISOString(),
        });
        rowIndexBySkillId.set(definition.id, rows.length - 1);
      }
    }
  }

  return rows;
}

/**
 * 실제 DB 저장 전용 함수
 *
 * 역할:
 * 1) life_profile_imports 저장
 * 2) fishing_profiles upsert
 * 3) farming_profiles upsert
 * 4) user_skill_levels upsert
 */
export async function saveParsedLifeProfile(params: {
  userId: string;
  parsed: ParsedLifeProfile;
  inputMethod: SaveLifeProfileInputMethod;
  rawText?: string | null;
}): Promise<void> {
  const userId = params.userId;
  const parsed = params.parsed;

  /**
   * 1) 입력 이력 저장
   */
  const importHistoryRow = buildImportHistoryRow({
    userId,
    parsed,
    inputMethod: params.inputMethod,
    rawText: params.rawText ?? null,
  });

  const { error: importInsertError } = await supabase
    .from("life_profile_imports")
    .insert(importHistoryRow);

  if (importInsertError) {
    throw new Error(`life_profile_imports 저장 실패: ${importInsertError.message}`);
  }

  /**
   * 2) 낚시 프로필 저장
   */
  if (parsed.jobs.fishing) {
    const fishingRow = buildFishingProfileRow(userId, parsed);

    const { error: fishingUpsertError } = await supabase
      .from("fishing_profiles")
      .upsert(fishingRow, {
        onConflict: "user_id",
      });

    if (fishingUpsertError) {
      throw new Error(`fishing_profiles 저장 실패: ${fishingUpsertError.message}`);
    }
  }

  /**
   * 3) 농사 프로필 저장
   */
  if (parsed.jobs.farming) {
    const farmingRow = buildFarmingProfileRow(userId, parsed);

    const { error: farmingUpsertError } = await supabase
      .from("farming_profiles")
      .upsert(farmingRow, {
        onConflict: "user_id",
      });

    if (farmingUpsertError) {
      throw new Error(`farming_profiles 저장 실패: ${farmingUpsertError.message}`);
    }
  }

  /**
   * 4) 스킬 저장
   *
   * imported:
   * - 파싱된 직업의 추적 스킬 전체를 기준으로 저장
   * - 없는 스킬은 0으로 저장
   *
   * manual:
   * - 현재 입력한 값만 저장
   * - 나중에 직접 입력을 직업별 탭 구조로 바꿀 때도 이 동작이 더 자연스럽다
   */
  const skillRows = await buildSkillRowsFromDefinitions(userId, parsed, {
    zeroFillMissingForParsedJobs: params.inputMethod === "imported",
  });

  if (skillRows.length > 0) {
    const { error: skillsUpsertError } = await supabase
      .from("user_skill_levels")
      .upsert(skillRows, {
        onConflict: "user_id,skill_id",
      });

    if (skillsUpsertError) {
      throw new Error(`user_skill_levels 저장 실패: ${skillsUpsertError.message}`);
    }
  }
}

/**
 * import 저장 함수
 *
 * 역할:
 * - ./생활 정보 원문 텍스트를 parser로 파싱
 * - DB 저장
 * - 저장 완료 후 ParsedLifeProfile 반환
 */
export async function saveLifeProfileFromText(
  userId: string,
  rawText: string,
): Promise<ParsedLifeProfile> {
  const parsed = parseLifeProfile(rawText);

  await saveParsedLifeProfile({
    userId,
    parsed,
    inputMethod: "imported",
    rawText,
  });

  return parsed;
}

/**
 * manual 저장 함수
 *
 * 역할:
 * - 직접 입력 폼 데이터를 표준 ParsedLifeProfile 구조로 변환
 * - DB 저장
 * - 저장 완료 후 ParsedLifeProfile 반환
 */
export async function saveManualLifeProfile(
  userId: string,
  input: ManualLifeProfileInput,
): Promise<ParsedLifeProfile> {
  const parsed = normalizeManualLifeProfileInput(input);

  await saveParsedLifeProfile({
    userId,
    parsed,
    inputMethod: "manual",
    rawText: null,
  });

  return parsed;
}