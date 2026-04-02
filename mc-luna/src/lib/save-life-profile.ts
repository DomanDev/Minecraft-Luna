// src/lib/save-life-profile.ts

import { supabase } from "@/src/lib/supabase";
import { parseLifeProfile } from "@/src/lib/parser";
import {
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
 * 이유:
 * - 현재 parser 결과는
 *   parsed.skills.fishing.treasureDetection = 3
 *   같은 내부 영문 key 구조를 사용
 *
 * - 하지만 DB의 skill_definitions는
 *   보통 skill_name_ko(한글명) 기준으로 정의되어 있음
 *
 * 따라서:
 * 내부 key -> DB에 저장된 실제 한글 스킬명
 * 매핑이 필요함
 *
 * 주의:
 * - skill_definitions.skill_name_ko 값과 정확히 일치해야 함
 * - 띄어쓰기까지 맞는 게 가장 안전함
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
};

/**
 * 내부 JobKey -> skill_definitions.job_code 매핑
 *
 * 이유:
 * - ParsedLifeProfile 쪽은 fishing / farming 같은 영문 key를 씀
 * - skill_definitions 테이블은 보통 job_code 컬럼으로 직업 구분
 * - DB에 저장된 job_code 값과 맞춰야 정확히 조회 가능
 *
 * 현재 추정:
 * - 낚시 -> fishing
 * - 농사 -> farming
 *
 * 만약 DB에서 job_code가 "fish", "farm"처럼 다르게 저장되어 있다면
 * 아래 값만 수정하면 됨
 */
const JOB_KEY_TO_DB_JOB_CODE: Record<string, string> = {
  fishing: "fishing",
  farming: "farming",
  mining: "mining",
  cooking: "cooking",
  blacksmithing: "blacksmithing",
  alchemy: "alchemy",
};

/**
 * life_profile_imports 저장 row 생성
 *
 * 역할:
 * - 어떤 방식으로 프로필이 들어왔는지 이력을 남김
 *
 * 현재 안전 정책:
 * - imported: 실제 rawText 저장
 * - manual: raw_text NOT NULL 제약과 충돌하지 않게 "[manual input]" 저장
 *
 * 만약 나중에 DB에서 raw_text nullable로 바꿨다면
 * manual일 때 null 저장으로 바꿔도 됨
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
      params.inputMethod === "manual"
        ? "[manual input]"
        : (params.rawText ?? ""),
    parsed_json: params.parsed,
    input_method: params.inputMethod,
  };
}

/**
 * user_skill_levels에 넣을 row 목록 생성
 *
 * 현재 DB 구조 기준:
 * - user_skill_levels는 job_key / skill_key를 직접 저장하지 않음
 * - skill_definitions에서 skill_id를 찾은 뒤
 *   user_id + skill_id + skill_level 형태로 저장해야 함
 *
 * 처리 순서:
 * 1) parsed.skills를 전부 순회
 * 2) 내부 영문 skill key를 한글 skill_name_ko로 변환
 * 3) skill_definitions에서 해당 스킬 정의 조회
 * 4) 찾은 definition.id를 skill_id로 사용해서 row 생성
 */
async function buildSkillRowsFromDefinitions(
  userId: string,
  parsed: ParsedLifeProfile,
) {
  /**
   * 최종적으로 user_skill_levels에 upsert할 row 목록
   */
  const rows: Array<{
    user_id: string;
    skill_id: string;
    skill_level: number;
    updated_at: string;
  }> = [];

  /**
   * 현재 parsed.skills에 실제 들어있는 직업만 순회
   *
   * 예:
   * parsed.skills.fishing
   * parsed.skills.farming
   */
  for (const [jobKey, skillMap] of Object.entries(parsed.skills)) {
    if (!skillMap) continue;

    const dbJobCode = JOB_KEY_TO_DB_JOB_CODE[jobKey];
    if (!dbJobCode) continue;

    /**
     * 이 직업에 대해 실제로 저장할 스킬 이름 목록만 뽑음
     *
     * 예:
     * treasureDetection -> 보물 감지
     * lineTension -> 낚싯줄 장력
     */
    const koreanSkillNames = Object.keys(skillMap)
      .map((skillKey) => SKILL_KEY_TO_KOREAN_NAME[skillKey])
      .filter(Boolean);

    /**
     * 저장할 스킬이 없으면 다음 직업으로 넘어감
     */
    if (koreanSkillNames.length === 0) {
      continue;
    }

    /**
     * skill_definitions에서
     * - 해당 직업(job_code)
     * - 해당 스킬명(skill_name_ko)
     * 에 해당하는 정의 목록 조회
     *
     * 주의:
     * 네 기존 레포 구조 기준으로는
     * skill_definitions에서 id, skill_name_ko, job_code를 읽는 방식이 맞았음
     */
    const { data: skillDefinitions, error: skillDefinitionsError } = await supabase
      .from("skill_definitions")
      .select("id, skill_name_ko, job_code")
      .eq("job_code", dbJobCode)
      .in("skill_name_ko", koreanSkillNames);

    if (skillDefinitionsError) {
      throw new Error(`skill_definitions 조회 실패: ${skillDefinitionsError.message}`);
    }

    /**
     * 조회된 정의를 "한글 스킬명 -> definition" 맵으로 바꿔두면
     * 이후 lookup이 편해짐
     */
    const definitionMap = new Map(
      (skillDefinitions ?? []).map((definition) => [
        definition.skill_name_ko,
        definition,
      ]),
    );

    /**
     * 실제 parsed된 스킬들을 순회하면서
     * 대응되는 skill_id를 찾아 row 생성
     */
    for (const [skillKey, level] of Object.entries(skillMap)) {
      const koreanSkillName = SKILL_KEY_TO_KOREAN_NAME[skillKey];
      if (!koreanSkillName) continue;

      const definition = definitionMap.get(koreanSkillName);

      /**
       * definition이 없다는 건
       * parser에는 있는데 DB skill_definitions에는 아직 등록 안 된 스킬이라는 뜻
       *
       * 이 경우 전체 저장을 터뜨릴 수도 있지만,
       * 우선은 다른 데이터 저장은 되게 하고
       * 콘솔 경고만 남기고 건너뛰는 방식이 실전에서 더 편함
       */
      if (!definition) {
        console.warn(
          `[save-life-profile] skill_definitions에 없는 스킬이라 건너뜀: ${jobKey} / ${skillKey} / ${koreanSkillName}`,
        );
        continue;
      }

      rows.push({
        user_id: userId,
        skill_id: definition.id,
        skill_level: toSafeNumber(level),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return rows;
}

/**
 * 실제 DB 저장 전용 함수
 *
 * 중요:
 * - auth.getUser()를 내부에서 직접 호출하지 않음
 * - 상위 컴포넌트(useAuth)에서 확보한 userId를 그대로 사용
 * - 이렇게 해야 Supabase auth lock 충돌 가능성을 줄일 수 있음
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
   *
   * parsed.jobs.fishing이 있을 때만 저장
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
   *
   * parsed.jobs.farming이 있을 때만 저장
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
   * 현재 DB 구조 기준:
   * - user_skill_levels에는 skill_id, skill_level을 저장
   * - skill_id는 skill_definitions에서 찾아와야 함
   */
  const skillRows = await buildSkillRowsFromDefinitions(userId, parsed);

  if (skillRows.length > 0) {
    const { error: skillsUpsertError } = await supabase
      .from("user_skill_levels")
      .upsert(skillRows, {
        /**
         * 현재 레포 기준 기존 구조는 user_id + skill_id 조합으로 upsert하는 형태였음
         *
         * 즉,
         * 같은 유저가 같은 스킬을 다시 저장하면 update 되고
         * 없으면 insert 됨
         */
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
 *
 * 반환 이유:
 * - profile/page.tsx에서 preview로 바로 보여주기 위함
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