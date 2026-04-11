export type MarketCategory =
  | "fishing"
  | "farming"
  | "mining"
  | "cooking"
  | "enhancement";

export type MarketGrade =
  | "normal"
  | "advanced"
  | "rare"
  | "single"
  | "normal_result"
  | "special_result";

export type MarketPriceItem = {
  key: string;
  name: string;
  iconPath?: string;
  category: MarketCategory;
  order: number;
  gradeType: "triple" | "single" | "cooking-result";
  prices: Partial<Record<MarketGrade, number>>;
};

export type UserMarketPriceRow = {
  id?: number;
  user_id: string;
  category: MarketCategory;
  item_key: string;
  grade: MarketGrade;
  price: number;
  created_at?: string;
  updated_at?: string;
};