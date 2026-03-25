import { supabase } from '../lib/supabase'
import { parseLifeProfileText } from '../lib/parser'
import { ParsedLifeProfile } from '../types/life-profile'
import { SkillDefinitionRow } from '../types/skill-definition'

const PARSE_VERSION = 'v1'

function createVerificationToken() {
  return crypto.randomUUID()
}

async function loadFishingSkillDefinitions(): Promise<SkillDefinitionRow[]>  {
  const { data, error } = await supabase
    .from('skill_definitions')
    .select('id, skill_code, skill_name_ko, job_code, skill_type, max_level, is_enabled')
    .eq('job_code', 'fishing')
    .eq('is_enabled', true)

  if (error) {
    throw new Error(`스킬 정의 조회 실패: ${error.message}`)
  }

  return data ?? []
}

async function insertLifeProfileImport(userId: string, parsed: ParsedLifeProfile) {
  const { error } = await supabase.from('life_profile_imports').insert({
    user_id: userId,
    raw_text: parsed.rawText,
    parsed_json: parsed,
    parse_version: PARSE_VERSION,
    verification_status: 'unverified',
    verification_token: createVerificationToken(),
  })

  if (error) {
    throw new Error(`life_profile_imports 저장 실패: ${error.message}`)
  }
}

async function upsertFishingProfile(userId: string, parsed: ParsedLifeProfile) {
  if (parsed.reputationLevel === null) {
    throw new Error('명성 레벨 파싱 실패')
  }

  if (parsed.fishingLevel === null) {
    throw new Error('낚시 레벨 파싱 실패')
  }
  const { error } = await supabase.from('fishing_profiles').upsert(
    {
      user_id: userId,
      reputation_level: parsed.reputationLevel,
      fishing_level: parsed.fishingLevel,

      luck_base: parsed.luck?.base ?? 0,
      luck_temp: parsed.luck?.temp ?? 0,
      luck_equip: parsed.luck?.equipValue ?? 0,
      luck_total: parsed.luck?.total ?? 0,

      sense_base: parsed.sense?.base ?? 0,
      sense_temp: parsed.sense?.temp ?? 0,
      sense_equip: parsed.sense?.equipValue ?? 0,
      sense_total: parsed.sense?.total ?? 0,

      fishing_yield_bonus_base: parsed.fishingYieldBonus?.base ?? 0,
      fishing_yield_bonus_temp: parsed.fishingYieldBonus?.temp ?? 0,
      fishing_yield_bonus_equip: parsed.fishingYieldBonus?.equipValue ?? 0,
      fishing_yield_bonus_total: parsed.fishingYieldBonus?.total ?? 0,

      normal_fish_reduction_base: parsed.normalFishReduction?.base ?? 0,
      normal_fish_reduction_temp: parsed.normalFishReduction?.temp ?? 0,
      normal_fish_reduction_equip: parsed.normalFishReduction?.equipValue ?? 0,
      normal_fish_reduction_total: parsed.normalFishReduction?.total ?? 0,

      nibble_time_reduction_base: parsed.nibbleTimeReduction?.base ?? 0,
      nibble_time_reduction_temp: parsed.nibbleTimeReduction?.temp ?? 0,
      nibble_time_reduction_equip: parsed.nibbleTimeReduction?.equipValue ?? 0,
      nibble_time_reduction_total: parsed.nibbleTimeReduction?.total ?? 0,

      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  )

  if (error) {
    throw new Error(`fishing_profiles 저장 실패: ${error.message}`)
  }
}

async function upsertUserSkillLevels(userId: string, parsed: ParsedLifeProfile) {
  const definitions = await loadFishingSkillDefinitions()

  const now = new Date().toISOString()

  const rows = parsed.fishingSkills
    .map((skill) => {
      const matched = definitions.find((d) => d.skill_name_ko === skill.name)
      if (!matched) return null

      return {
        user_id: userId,
        skill_id: matched.id,
        skill_level: skill.level,
        imported_at: now,
        updated_at: now,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (rows.length === 0) {
    return
  }

  const { error } = await supabase.from('user_skill_levels').upsert(rows, {
    onConflict: 'user_id,skill_id',
  })

  if (error) {
    throw new Error(`user_skill_levels 저장 실패: ${error.message}`)
  }
}

export async function saveLifeProfileFromText(rawText: string) {
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('생활 정보 텍스트를 입력해주세요.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('로그인이 필요합니다.')
  }

  const parsed = parseLifeProfileText(trimmed)

  await insertLifeProfileImport(user.id, parsed)
  await upsertFishingProfile(user.id, parsed)
  await upsertUserSkillLevels(user.id, parsed)

  return parsed
}