import { ParsedFishingSkill, ParsedLifeProfile, ParsedStatValue } from '../types/life-profile'

const FISHING_SKILL_NAMES = [
  '보물 감지',
  '소문난 미끼',
  '낚싯줄 장력',
  '쌍걸이',
  '떼낚시',
] as const

function toNumber(value: string | undefined | null): number {
  if (!value) return 0
  const normalized = value.replace(/,/g, '').trim()
  const n = Number(normalized)
  return Number.isNaN(n) ? 0 : n
}

// 텍스트 통일(줄바꿈 정규화)
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// 구간별 나눔 -> 스탯 정보, 숙련도, 스킬 등
function extractSection(text: string, sectionName: string): string {
  const normalized = normalizeText(text)
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const regex = new RegExp(
    `^\\[${escaped}\\]\\s*\\n([\\s\\S]*?)(?=^\\[[^\\]]+\\]\\s*$|\\Z)`,
    'm'
  )

  const match = normalized.match(regex)
  return match?.[1]?.trim() ?? ''
}

// 스탯 정보 추출
function parseStatLine(sectionText: string, statName: string): ParsedStatValue | null {
  const escaped = statName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const regex = new RegExp(
    `ㆍ\\s*${escaped}\\s*\\(\\s*base\\s*:\\s*([-0-9.,]+)\\s*/\\s*temp\\s*:\\s*([-0-9.,]+)\\s*/\\s*equip\\s*:\\s*([-0-9.,]+)\\s*/\\s*total\\s*:\\s*([-0-9.,]+)\\s*\\)`,
    'm'
  )

  const match = sectionText.match(regex)
  if (!match) return null

  return {
    base: toNumber(match[1]),
    temp: toNumber(match[2]),
    equipValue: toNumber(match[3]),
    total: toNumber(match[4]),
  }
}

// 명성 레벨 추출
function parseReputationLevel(text: string): number | null {
  const match = text.match(/명성\s*:\s*(\d+)/)
  return match ? Number(match[1]) : null
}

function parseFishingLevel(proficiencySection: string): number | null {
  if (!proficiencySection) return null

  const normalized = normalizeText(proficiencySection)

  // 숫자 패턴 찾기
  const match = normalized.match(
    /^[^\S\n\r]*ㆍ\s*낚시\s*\(Lv\s*:\s*(\d+)/m
  )

  return match ? Number(match[1]) : null
}

function parseFishingSkills(skillSection: string): ParsedFishingSkill[] {
  const result: ParsedFishingSkill[] = []

  for (const skillName of FISHING_SKILL_NAMES) {
    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const regexes = [
      new RegExp(`ㆍ\\s*${escaped}\\s*\\(\\s*Lv\\s*:\\s*(\\d+)\\s*\\)`, 'i'),
      new RegExp(`ㆍ\\s*${escaped}\\s*\\(\\s*Lv\\.\\s*(\\d+)\\s*\\)`, 'i'),
      new RegExp(`ㆍ\\s*${escaped}\\s*Lv\\.?\\s*(\\d+)`, 'i'),
    ]

    let level: number | null = null

    for (const regex of regexes) {
      const match = skillSection.match(regex)
      if (match) {
        level = Number(match[1])
        break
      }
    }

    if (level !== null) {
      result.push({
        name: skillName,
        level,
      })
    }
  }

  return result
}

export function parseLifeProfileText(rawText: string): ParsedLifeProfile {
  const statSection = extractSection(rawText, '스탯 정보')
  const proficiencySection = extractSection(rawText, '숙련도')
  const skillSection = extractSection(rawText, '스킬')

  console.log('statSection:', statSection)
    console.log('proficiencySection:', proficiencySection)
    console.log('skillSection:', skillSection)
    console.log('parsed fishing level:', parseFishingLevel(proficiencySection))

  return {
    reputationLevel: parseReputationLevel(rawText),
    fishingLevel: parseFishingLevel(proficiencySection),

    luck: parseStatLine(statSection, '행운'),
    sense: parseStatLine(statSection, '감각'),
    fishingYieldBonus: parseStatLine(statSection, '어획량 증가율'),
    normalFishReduction: parseStatLine(statSection, '일반 물고기 감소비율'),
    nibbleTimeReduction: parseStatLine(statSection, '기척 시간 감소'),

    fishingSkills: parseFishingSkills(skillSection),

    rawText,
  }
}