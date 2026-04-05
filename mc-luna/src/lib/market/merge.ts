import type { MarketPriceItem, UserMarketPriceRow } from "./types";

export function mergeUserPrices(
  baseItems: MarketPriceItem[],
  userRows: UserMarketPriceRow[],
): MarketPriceItem[] {
  const rowMap = new Map(
    userRows.map((row) => [`${row.category}:${row.item_key}:${row.grade}`, row.price]),
  );

  return baseItems.map((item) => {
    const nextPrices = { ...item.prices };

    Object.keys(item.prices).forEach((gradeKey) => {
      const key = `${item.category}:${item.key}:${gradeKey}`;
      const userPrice = rowMap.get(key);
      if (typeof userPrice === "number") {
        nextPrices[gradeKey as keyof typeof nextPrices] = userPrice;
      }
    });

    return {
      ...item,
      prices: nextPrices,
    };
  });
}