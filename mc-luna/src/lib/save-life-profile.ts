// src/lib/save-life-profile.ts

import { supabase } from "@/src/lib/supabase";
import { BLESSING_OF_HARVEST_NORMAL_REDUCTION } from "@/src/lib/farming/skillTables";
import { parseLifeProfile } from "@/src/lib/parser";
import {
  type JobKey,
  type ManualLifeProfileInput,
  type ParsedLifeProfile,
  normalizeManualLifeProfileInput,
} from "@/src/types/life-profile";
import { getLineTensionValue } from "@/src/lib/fishing/skillTables";

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
 * 풍년의 축복 레벨에 따른 일반 작물 감소비율 반환
 *
 * 주의:
 * - 농사 계산기(calc.ts / skillTables.ts)에서 사용하는 값과
 *   동일한 기준이어야 한다.
 * - 현재 프로젝트 정책상 풍년의 축복 감소값은
 *   스킬 레벨로 계산하고,
 *   farming_profiles.normal_crop_reduction_total 에는
 *   "도감/기타로 인한 감소분만" 저장한다.
 */
function getBlessingOfHarvestReduction(level: number): number {
  const safeLevel = toSafeNumber(level);
  return BLESSING_OF_HARVEST_NORMAL_REDUCTION[safeLevel] ?? 0;
}

/**
 * 낚시 도감 일반 물고기 감소비율만 분리하는 함수
 *
 * imported:
 * - /생활 정보 원문 total 값에는 낚싯줄 장력 스킬 효과가 포함될 수 있음
 * - 계산기에서는 낚싯줄 장력을 스킬 레벨로 따로 계산하므로 여기서 제외해야 함
 *
 * manual:
 * - 프로필 페이지 직접 입력값은 이미 "도감 효과"로 입력하는 값이므로 차감하지 않음
 */
function getCodexNormalFishReduction(params: {
  parsedNormalFishReductionTotal: number;
  lineTensionLevel: number;
  inputMethod: SaveLifeProfileInputMethod;
}): number {
  const parsedTotal = toSafeNumber(params.parsedNormalFishReductionTotal);

  if (params.inputMethod !== "imported") {
    return Math.max(0, parsedTotal);
  }

  /** 낚싯줄 장력 레벨에 따른 일반 물고기 감소비율 */
  const lineTensionReduction = getLineTensionValue(params.lineTensionLevel);

  /** 생활 정보 total 값에서 낚싯줄 장력 효과를 제거한 도감/기타 감소분 */
  return Math.max(0, parsedTotal - lineTensionReduction);
}

/**
 * 낚시 프로필 row 생성
 *
 * 역할:
 * - ParsedLifeProfile 내부의 jobs.fishing 데이터를
 *   fishing_profiles 테이블 row 형태로 변환
 *
 * 중요:
 * - imported 방식의 /생활 정보 total 값에는 낚싯줄 장력 효과가 포함될 수 있음
 * - 계산기에서는 낚싯줄 장력을 스킬 레벨로 별도 계산하므로
 *   normal_fish_reduction_total에는 도감/기타 감소분만 저장해야 함
 */
function buildFishingProfileRow(
  userId: string,
  parsed: ParsedLifeProfile,
  inputMethod: SaveLifeProfileInputMethod,
) {
  /** 낚시 직업 프로필 */
  const fishingJob = parsed.jobs.fishing;

  /** 낚시 스탯 목록 */
  const fishingStats = fishingJob?.stats ?? {};

  /** 낚시 스킬 목록 */
  const fishingSkills = parsed.skills.fishing ?? {};

  /** /생활 정보 또는 직접 입력에서 넘어온 일반 물고기 감소비율 total */
  const parsedNormalFishReductionTotal = toSafeNumber(
    fishingStats.normalFishReduction?.total,
  );

  /** 낚싯줄 장력 스킬 레벨 */
  const lineTensionLevel = toSafeNumber(fishingSkills.lineTension);

  /** DB에 저장할 도감/기타 일반 물고기 감소비율 */
  const codexNormalFishReductionTotal = getCodexNormalFishReduction({
    parsedNormalFishReductionTotal,
    lineTensionLevel,
    inputMethod,
  });

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

    /**
     * 낚시 도감 효과
     * - 일반 물고기 감소비율
     *
     * 저장 정책:
     * - imported: 생활 정보 total - 낚싯줄 장력 스킬 감소값
     * - manual: 직접 입력값을 이미 도감 효과로 보고 그대로 저장
     *
     * 참고:
     * - imported에서는 base/temp/equip를 정확히 다시 분리하기 어려우므로
     *   농사 프로필 저장 방식처럼 equip/total에 최종 도감값을 둔다.
     */
    normal_fish_reduction_base:
      inputMethod === "imported"
        ? 0
        : toSafeNumber(fishingStats.normalFishReduction?.base),
    normal_fish_reduction_temp:
      inputMethod === "imported"
        ? 0
        : toSafeNumber(fishingStats.normalFishReduction?.temp),
    normal_fish_reduction_equip:
      inputMethod === "imported"
        ? codexNormalFishReductionTotal
        : toSafeNumber(fishingStats.normalFishReduction?.equip),
    normal_fish_reduction_total: codexNormalFishReductionTotal,

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
  const farmingSkills = parsed.skills.farming ?? {};

  /**
   * /생활 정보의 [스탯 정보]에 표시되는 "일반 작물 감소비율 total" 값은
   * 풍년의 축복 스킬 효과 + 도감/장비 등 기타 감소분이 합쳐진 값일 수 있다.
   *
   * 하지만 계산기에서는
   * - 풍년의 축복 감소값: 스킬 레벨로 별도 계산
   * - 도감 감소값: farming_profiles.normal_crop_reduction_total 에서 불러옴
   *
   * 구조이므로, 저장 단계에서 "풍년의 축복 감소값"을 제외한
   * 도감/기타 감소분만 farming_profiles에 저장해야 한다.
   */
  const parsedNormalCropReductionTotal = toSafeNumber(
    farmingStats.normalCropReduction?.total,
  );
  const blessingOfHarvestLevel = toSafeNumber(
    farmingSkills.blessingOfHarvest,
  );

  /**
   * 풍년의 축복 레벨에 따른 일반 작물 감소비율
   *
   * 주의:
   * - 아래 함수(getBlessingOfHarvestReduction)는
   *   farming/skillTables.ts 기준과 동일해야 한다.
   * - 가장 좋은 방법은 save-life-profile.ts 상단에서
   *   BLESSING_OF_HARVEST_NORMAL_REDUCTION 을 import 해서 사용하는 것이다.
   */
  const blessingOfHarvestReduction =
    getBlessingOfHarvestReduction(blessingOfHarvestLevel);

  /**
   * 최종적으로 farming_profiles 에 저장할 값은
   * "도감/기타 일반 작물 감소비율"만 남긴다.
   *
   * 음수가 되면 의미가 없으므로 0 미만은 잘라낸다.
   */
  const codexNormalCropReductionTotal = Math.max(
    0,
    parsedNormalCropReductionTotal - blessingOfHarvestReduction,
  );

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

    /**
     * 농사 도감 효과
     * - 일반 작물 감소비율
     *
     * 저장 정책:
     * - /생활 정보 total 값을 그대로 저장하지 않음
     * - total - 풍년의 축복 감소값
     *   => "도감/기타 감소분만" 저장
     *
     * 참고:
     * - 현재 /생활 정보 원문만으로는 base/temp/equip를 정확히 다시 분리하기 어려워
     *   우선 계산기에서 필요한 최종 도감 감소 총합만 맞춘다.
     */
    normal_crop_reduction_base: 0,
    normal_crop_reduction_temp: 0,
    normal_crop_reduction_equip: codexNormalCropReductionTotal,
    normal_crop_reduction_total: codexNormalCropReductionTotal,

    updated_at: new Date().toISOString(),
  };
}

/**
 * 요리 프로필 row 생성
 *
 * 역할:
 * - ParsedLifeProfile 내부의 jobs.cooking 데이터를
 *   cooking_profiles 테이블 row 형태로 변환
 *
 * 주의:
 * - 현재 요리 계산기에서 실제로 사용하는 핵심 값은
 *   mastery_total, dexterity_total, cooking_grade_up_chance_total 이지만,
 *   이후 확장성과 프로필 표시 일관성을 위해
 *   공통 스탯 6종을 모두 cooking_profiles에 저장한다.
 * - /생활 정보 원문 또는 manual 입력 구조상
 *   각 값의 base/temp/equip 분리가 가능한 경우 그대로 저장하고,
 *   값이 없으면 0으로 안전하게 처리한다.
 */
function buildCookingProfileRow(userId: string, parsed: ParsedLifeProfile) {
  const cookingJob = parsed.jobs.cooking;
  const cookingStats = cookingJob?.stats ?? {};

  return {
    user_id: userId,
    level: toSafeNumber(cookingJob?.level),

    luck_base: toSafeNumber(cookingStats.luck?.base),
    luck_temp: toSafeNumber(cookingStats.luck?.temp),
    luck_equip: toSafeNumber(cookingStats.luck?.equip),
    luck_total: toSafeNumber(cookingStats.luck?.total),

    sense_base: toSafeNumber(cookingStats.sense?.base),
    sense_temp: toSafeNumber(cookingStats.sense?.temp),
    sense_equip: toSafeNumber(cookingStats.sense?.equip),
    sense_total: toSafeNumber(cookingStats.sense?.total),

    endurance_base: toSafeNumber(cookingStats.endurance?.base),
    endurance_temp: toSafeNumber(cookingStats.endurance?.temp),
    endurance_equip: toSafeNumber(cookingStats.endurance?.equip),
    endurance_total: toSafeNumber(cookingStats.endurance?.total),

    mastery_base: toSafeNumber(cookingStats.mastery?.base),
    mastery_temp: toSafeNumber(cookingStats.mastery?.temp),
    mastery_equip: toSafeNumber(cookingStats.mastery?.equip),
    mastery_total: toSafeNumber(cookingStats.mastery?.total),

    dexterity_base: toSafeNumber(cookingStats.dexterity?.base),
    dexterity_temp: toSafeNumber(cookingStats.dexterity?.temp),
    dexterity_equip: toSafeNumber(cookingStats.dexterity?.equip),
    dexterity_total: toSafeNumber(cookingStats.dexterity?.total),

    charisma_base: toSafeNumber(cookingStats.charisma?.base),
    charisma_temp: toSafeNumber(cookingStats.charisma?.temp),
    charisma_equip: toSafeNumber(cookingStats.charisma?.equip),
    charisma_total: toSafeNumber(cookingStats.charisma?.total),

    /**
     * 요리 도감 효과
     * - 요리 등급업 확률
     *
     * 저장 정책:
     * - 현재 요리 계산기에서는 total 값을 직접 사용하므로
     *   base/temp/equip/total을 가능한 범위에서 그대로 저장한다.
     * - manual 입력에서는 보통 total 중심으로 들어오더라도
     *   normalize 단계에서 맞춰진 값을 그대로 반영한다.
     */
    cooking_grade_up_chance_base: toSafeNumber(
      cookingStats.cookingGradeUpChance?.base,
    ),
    cooking_grade_up_chance_temp: toSafeNumber(
      cookingStats.cookingGradeUpChance?.temp,
    ),
    cooking_grade_up_chance_equip: toSafeNumber(
      cookingStats.cookingGradeUpChance?.equip,
    ),
    cooking_grade_up_chance_total: toSafeNumber(
      cookingStats.cookingGradeUpChance?.total,
    ),

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
  temperedPickaxe: "단련된 곡괭이",
  veinSense: "광맥 감각",
  veinFlow: "광맥 흐름",
  veinDetection: "광맥 탐지",
  explosiveMining: "폭발적인 채광",

  // 요리
  preparationMaster: "손질 달인",
  balanceOfTaste: "맛의 균형",
  gourmet: "미식가",
  instantCompletion: "즉시 완성",
  banquetPreparation: "연회 준비",
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
    raw_text: params.inputMethod === "manual" ? "[manual input]" : (params.rawText ?? ""),
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
  return (Object.entries(parsed.jobs) as Array<
    [JobKey, ParsedLifeProfile["jobs"][JobKey]]
  >)
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
  options?: { zeroFillMissingForParsedJobs?: boolean },
) {
  const zeroFillMissingForParsedJobs =
    options?.zeroFillMissingForParsedJobs ?? false;

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
   * 2) 실제 parsed.skills 값으로 row를 덮어쓴다.
   *
   * manual 저장이든 imported 저장이든
   * 이번에 들어온 스킬 값은 여기서 최종 반영된다.
   */
  for (const [jobKey, skillMap] of Object.entries(parsed.skills) as Array<
    [JobKey, ParsedLifeProfile["skills"][JobKey]]
  >) {
    if (!skillMap) continue;

    const dbJobCode = JOB_KEY_TO_DB_JOB_CODE[jobKey];
    if (!dbJobCode) continue;

    for (const [skillKey, level] of Object.entries(skillMap)) {
      const koreanName = SKILL_KEY_TO_KOREAN_NAME[skillKey];
      if (!koreanName) continue;

      const definition = definitionMap.get(`${dbJobCode}::${koreanName}`);

      if (!definition) {
        console.warn(
          `[save-life-profile] skill_definitions 매칭 실패: ${dbJobCode} / ${koreanName}`,
        );
        continue;
      }

      const existingIndex = rows.findIndex(
        (row) => row.skill_id === definition.id,
      );

      const nextRow = {
        user_id: userId,
        skill_id: definition.id,
        skill_level: toSafeNumber(level),
        updated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        rows[existingIndex] = nextRow;
      } else {
        rows.push(nextRow);
      }
    }
  }

  return rows;
}

/**
 * ParsedLifeProfile 전체를 DB에 저장
 *
 * 저장 대상:
 * - life_profile_imports
 * - fishing_profiles (있으면)
 * - farming_profiles (있으면)
 * - cooking_profiles (있으면)
 * - user_skill_levels
 */
export async function saveParsedLifeProfile(params: {
  userId: string;
  parsed: ParsedLifeProfile;
  inputMethod: SaveLifeProfileInputMethod;
  rawText?: string | null;
}) {
  const { userId, parsed, inputMethod } = params;

  /**
   * 1) import/manual 이력 저장
   */
  const importRow = buildImportHistoryRow({
    userId,
    parsed,
    inputMethod,
    rawText: params.rawText ?? null,
  });

  const { error: importError } = await supabase
    .from("life_profile_imports")
    .insert(importRow);

  if (importError) {
    throw new Error(`life_profile_imports 저장 실패: ${importError.message}`);
  }

  /**
   * 2) 직업별 프로필 테이블 저장
   */
  if (parsed.jobs.fishing) {
    const fishingRow = buildFishingProfileRow(userId, parsed, inputMethod);

    const { error: fishingError } = await supabase
      .from("fishing_profiles")
      .upsert(fishingRow, { onConflict: "user_id" });

    if (fishingError) {
      throw new Error(`fishing_profiles 저장 실패: ${fishingError.message}`);
    }
  }

  if (parsed.jobs.farming) {
    const farmingRow = buildFarmingProfileRow(userId, parsed);

    const { error: farmingError } = await supabase
      .from("farming_profiles")
      .upsert(farmingRow, { onConflict: "user_id" });

    if (farmingError) {
      throw new Error(`farming_profiles 저장 실패: ${farmingError.message}`);
    }
  }

  /**
   * 요리 프로필 저장
   *
   * 조건:
   * - ParsedLifeProfile 안에 jobs.cooking 이 실제로 있을 때만 저장
   *
   * 역할:
   * - cooking_profiles 테이블에 현재 요리 스탯/도감 값을 upsert
   * - 이후 요리 계산기 페이지 진입 시
   *   mastery_total / dexterity_total / cooking_grade_up_chance_total 등을
   *   자동으로 불러올 수 있게 한다.
   */
  if (parsed.jobs.cooking) {
    const cookingRow = buildCookingProfileRow(userId, parsed);

    const { error: cookingError } = await supabase
      .from("cooking_profiles")
      .upsert(cookingRow, { onConflict: "user_id" });

    if (cookingError) {
      throw new Error(`cooking_profiles 저장 실패: ${cookingError.message}`);
    }
  }

  /**
   * 3) user_skill_levels 저장
   *
   * imported:
   * - 파싱된 직업의 전체 추적 스킬을 기준으로 0-fill 후 upsert
   *
   * manual:
   * - 직접 입력된 스킬만 기준으로 upsert
   */
  const skillRows = await buildSkillRowsFromDefinitions(userId, parsed, {
    zeroFillMissingForParsedJobs: inputMethod === "imported",
  });

  if (skillRows.length > 0) {
    const { error: skillsError } = await supabase
      .from("user_skill_levels")
      .upsert(skillRows, { onConflict: "user_id,skill_id" });

    if (skillsError) {
      throw new Error(`user_skill_levels 저장 실패: ${skillsError.message}`);
    }
  }
}

/**
 * ./생활 정보 원문 텍스트 -> 파싱 -> 저장
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
 * 프로필 페이지 직접 입력값 -> ParsedLifeProfile 정규화 -> 저장
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