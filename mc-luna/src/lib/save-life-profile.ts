// src/lib/save-life-profile.ts

import { supabase } from "@/src/lib/supabase";
import { parseLifeProfileText } from "@/src/lib/parser";

/**
 * =========================
 * 기존: 파싱된 객체 저장
 * =========================
 */
export async function saveLifeProfile(parsed: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  /**
   * =========================
   * 1. 원본 + 파싱 결과 저장
   * =========================
   */
  await supabase.from("life_profile_imports").insert({
    user_id: user.id,
    raw_text: parsed.rawText,
    parsed_json: parsed,
  });

  /**
   * =========================
   * 2. fishing_profiles 저장
   * =========================
   */
  await supabase.from("fishing_profiles").upsert({
    user_id: user.id,

    luck_base: parsed.luck?.base ?? 0,
    luck_temp: parsed.luck?.temp ?? 0,
    luck_equip: parsed.luck?.equipValue ?? 0,
    luck_total: parsed.luck?.total ?? 0,

    sense_base: parsed.sense?.base ?? 0,
    sense_temp: parsed.sense?.temp ?? 0,
    sense_equip: parsed.sense?.equipValue ?? 0,
    sense_total: parsed.sense?.total ?? 0,

    updated_at: new Date().toISOString(),
  });

  /**
   * =========================
   * 3. farming_profiles 저장 (🔥 추가)
   * =========================
   */
  await supabase.from("farming_profiles").upsert({
    user_id: user.id,

    luck_base: parsed.luck?.base ?? 0,
    luck_temp: parsed.luck?.temp ?? 0,
    luck_equip: parsed.luck?.equipValue ?? 0,
    luck_total: parsed.luck?.total ?? 0,

    sense_base: parsed.sense?.base ?? 0,
    sense_temp: parsed.sense?.temp ?? 0,
    sense_equip: parsed.sense?.equipValue ?? 0,
    sense_total: parsed.sense?.total ?? 0,

    updated_at: new Date().toISOString(),
  });

  /**
   * =========================
   * 4. 스킬 저장 (fishing + farming)
   * =========================
   */
  const { data: skillDefinitions } = await supabase
    .from("skill_definitions")
    .select("id, skill_name_ko, job_code")
    .in("job_code", ["fishing", "farming"]);

  const skillUpserts = (skillDefinitions ?? [])
    .map((def) => {
      const level = parsed.skills?.[def.skill_name_ko];
      if (level == null) return null;

      return {
        user_id: user.id,
        skill_id: def.id,
        skill_level: level,
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (skillUpserts.length > 0) {
    await supabase.from("user_skill_levels").upsert(skillUpserts, {
      onConflict: "user_id,skill_id",
    });
  }
}

/**
 * =========================
 * 🔥 추가: 텍스트 → 파싱 → 저장
 * =========================
 *
 * profile/page.tsx에서 사용하는 함수
 */
export async function saveLifeProfileFromText(rawText: string) {
  // 1. 텍스트 파싱
  const parsed = parseLifeProfileText(rawText);

  // 2. 기존 저장 함수 호출
  await saveLifeProfile(parsed);

  return parsed;
}