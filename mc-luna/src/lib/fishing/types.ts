export type FishingEnvironment = {
  isNight: boolean;
  baitType: 'none' | 'worm';
  chumType: 'none' | 'normal' | 'good' | 'rainbow';
  pondState: 'rich' | 'normal' | 'depleted';
};

export type FishingStats = {
  luck: number;
  sense: number;
};

export type FishingSkills = {
  hasDoubleHook: boolean;
  doubleHookChance: number;
  hasSchoolFishing: boolean;
  hasFamousBait: boolean;
  hasLineTension: boolean;
};

export type FishPriceTable = {
  common: number;
  uncommon: number;
  rare: number;
};

export type FishingCalculatorInput = {
  baseSignsTime: number;
  baseBiteTime: number;
  stats: FishingStats;
  skills: FishingSkills;
  environment: FishingEnvironment;
  prices: FishPriceTable;
};

export type FishingCalculatorResult = {
  totalTimePerCatch: number;
  catchesPerHour: number;
  expectedFishPerCatch: number;
  expectedValuePerCatch: number;
  expectedProfitPerHour: number;
};