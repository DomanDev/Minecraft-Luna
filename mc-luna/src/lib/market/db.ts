import { supabase } from "@/src/lib/supabase";
import type { MarketCategory, UserMarketPriceRow } from "./types";

export async function loadUserMarketPrices(userId: string, category?: MarketCategory) {
  let query = supabase
    .from("user_market_prices")
    .select("*")
    .eq("user_id", userId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as UserMarketPriceRow[];
}

export async function upsertUserMarketPrices(rows: UserMarketPriceRow[]) {
  const { error } = await supabase
    .from("user_market_prices")
    .upsert(rows, {
      onConflict: "user_id,category,item_key,grade",
    });

  if (error) throw error;
}