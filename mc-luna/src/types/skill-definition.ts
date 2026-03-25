export type SkillDefinitionRow = {
  id: number
  skill_code: string
  skill_name_ko: string
  job_code: string
  skill_type: string | null
  max_level: number | null
  is_enabled: boolean
}