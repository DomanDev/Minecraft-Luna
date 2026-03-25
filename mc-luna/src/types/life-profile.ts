export type ParsedStatValue = {
  base: number
  temp: number
  equipValue: number
  total: number
}

export type ParsedFishingSkill = {
  name: string
  level: number
}

export type ParsedLifeProfile = {
  reputationLevel: number | null
  fishingLevel: number | null

  luck: ParsedStatValue | null
  sense: ParsedStatValue | null
  fishingYieldBonus: ParsedStatValue | null
  normalFishReduction: ParsedStatValue | null
  nibbleTimeReduction: ParsedStatValue | null

  fishingSkills: ParsedFishingSkill[]

  rawText: string
}