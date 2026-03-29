export type ParsedStatValue = {
  base: number;
  temp: number;
  equipValue: number;
  total: number;
};

export type ParsedLifeProfile = {
  reputationLevel: number | null;

  // 숙련도
  fishingLevel: number | null;
  farmingLevel: number | null;

  // 공통 스탯
  luck: ParsedStatValue | null;
  sense: ParsedStatValue | null;

  // 낚시 전용 스탯
  fishingYieldBonus: ParsedStatValue | null;
  normalFishReduction: ParsedStatValue | null;
  nibbleTimeReduction: ParsedStatValue | null;

  /**
   * 모든 생활 스킬 레벨을 한글 스킬명 기준으로 저장
   * 예:
   * {
   *   "보물 감지": 10,
   *   "풍년의 축복": 20
   * }
   */
  skills: Record<string, number>;

  rawText: string;
};