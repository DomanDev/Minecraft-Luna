import { supabase } from '@/src/lib/supabase';
import type {
  ProfileSeasonLocation,
  VillageRow,
  VillageTimeReferenceRow,
  WorldTimeReferenceRow,
} from '@/src/lib/season/types';

/**
 * =========================
 * 계절 관련 Supabase 조회 함수
 * =========================
 *
 * 역할 분리 이유:
 * - app/profile/page.tsx 와 app/season/page.tsx 에서
 *   같은 villages / references / profile location 조회 로직을 재사용하기 위함
 * - 페이지 파일에 DB 쿼리가 중복되는 것을 막기 위함
 */

export async function fetchActiveVillages(): Promise<VillageRow[]> {
  const { data, error } = await supabase
    .from('villages')
    .select('id, world_key, village_name, is_active, display_order, created_at, updated_at')
    .eq('is_active', true)
    .order('world_key', { ascending: true })
    .order('display_order', { ascending: true })
    .order('village_name', { ascending: true });

  if (error) {
    throw new Error(`마을 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []) as VillageRow[];
}

/**
 * village_time_references 는 마을별로 여러 건이 쌓일 수 있으므로,
 * 최신 관측값 1건만 사용하는 맵 형태로 정리해서 반환한다.
 */
export async function fetchLatestVillageTimeReferences(): Promise<
  Record<string, VillageTimeReferenceRow>
> {
  const { data, error } = await supabase
    .from('village_time_references')
    .select(
      'id, village_id, real_observed_at, ingame_month, ingame_day, ingame_hour, ingame_minute, offset_from_base_minutes, memo, created_at, updated_at',
    )
    .order('village_id', { ascending: true })
    .order('real_observed_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`마을 기준 시각 조회 실패: ${error.message}`);
  }

  const latestByVillageId: Record<string, VillageTimeReferenceRow> = {};

  for (const row of (data ?? []) as VillageTimeReferenceRow[]) {
    if (!latestByVillageId[row.village_id]) {
      latestByVillageId[row.village_id] = row;
    }
  }

  return latestByVillageId;
}

/**
 * world_time_references 는 월드별로 여러 건이 쌓일 수 있으므로,
 * 최신 관측값 1건만 사용하는 맵 형태로 정리해서 반환한다.
 */
export async function fetchLatestWorldTimeReferences(): Promise<
  Record<string, WorldTimeReferenceRow>
> {
  const { data, error } = await supabase
    .from('world_time_references')
    .select(
      'id, world_key, real_observed_at, ingame_month, ingame_day, ingame_hour, ingame_minute, offset_from_base_minutes, memo, created_at, updated_at',
    )
    .order('world_key', { ascending: true })
    .order('real_observed_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`월드 기준 시각 조회 실패: ${error.message}`);
  }

  const latestByWorldKey: Record<string, WorldTimeReferenceRow> = {};

  for (const row of (data ?? []) as WorldTimeReferenceRow[]) {
    if (!latestByWorldKey[row.world_key]) {
      latestByWorldKey[row.world_key] = row;
    }
  }

  return latestByWorldKey;
}

/**
 * 로그인 사용자의 season 기본 위치를 읽어온다.
 * - current_world_key: 마을이 없어도 월드 기본값을 복원하기 위해 필요
 * - current_village_id: 마을이 있으면 season page 기본 선택값으로 사용
 */
export async function fetchMyProfileSeasonLocation(
  userId: string,
): Promise<ProfileSeasonLocation> {
  const { data, error } = await supabase
    .from('profiles')
    .select('current_world_key, current_village_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`프로필 위치 조회 실패: ${error.message}`);
  }

  return {
    current_world_key: (data?.current_world_key ?? null) as ProfileSeasonLocation['current_world_key'],
    current_village_id: data?.current_village_id ?? null,
  };
}
