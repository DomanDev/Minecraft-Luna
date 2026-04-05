/**
 * 마인크래프트 프로필/이미지 관련 유틸
 *
 * 변경 이유:
 * - 기존에는 Crafatar 기반 URL을 사용했지만,
 *   현재 일부 모바일/태블릿 환경에서 이미지가 비어 보이는 증상이 있었다.
 * - 이번 버전에서는 "실제 사이트에서 쓸 머리 이미지"를 안정적으로 표시하는 것을 우선으로 하여
 *   MCHeads의 head/avatar 엔드포인트를 기본으로 사용한다.
 *
 * 참고:
 * - profile page에서는 이제 큰 바디 렌더가 아니라
 *   "작은 머리 이미지"만 일관되게 사용한다.
 */

export type MinecraftLinkStatus = 'needs_lookup' | 'linked' | 'verified';

export type MinecraftLookupResult = {
  nickname: string;
  uuid: string;

  /**
   * profile page에서는 현재 avatarUrl을
   * "작은 머리 이미지" 용도로 사용한다.
   *
   * 즉 이름은 avatarUrl이지만,
   * 실제 UI 목적은 프로필/헤더/연동 확인 모달에서 쓰는 대표 head 이미지다.
   */
  avatarUrl: string;

  /**
   * headUrl도 같은 성격의 머리 이미지 URL로 유지한다.
   * 현재 UI에서는 avatarUrl과 동일 계열 이미지를 써도 무방하지만,
   * 구조 호환을 위해 별도 필드를 유지한다.
   */
  headUrl: string;

  /**
   * 현재 UI에서는 사용하지 않지만,
   * 기존 API 응답 구조와의 호환성을 위해 남겨둔다.
   */
  bodyRenderUrl: string;
  skinUrl: string;
};

/**
 * dashed UUID -> plain UUID 정규화
 *
 * 외부 이미지 서비스마다 dashed / plain UUID 허용 여부가 다를 수 있으므로
 * 일관되게 plain UUID 형태로 맞춰서 사용한다.
 */
export function normalizeMinecraftUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}

/**
 * username 우선 / 없으면 uuid 사용용 식별자 정리
 *
 * MCHeads는 username 또는 uuid를 식별자로 받을 수 있다.
 * 현재 프로젝트에서는 조회 직후에는 nickname이 확실하므로 nickname 사용이 가장 안정적이고,
 * 저장 후 렌더링에서는 username이 있으면 username,
 * 없으면 uuid를 fallback으로 쓰는 형태가 자연스럽다.
 */
function resolveMinecraftIdentifier(
  username?: string | null,
  uuid?: string | null,
): string {
  if (username && username.trim() !== '') {
    return username.trim();
  }

  if (uuid && uuid.trim() !== '') {
    return normalizeMinecraftUuid(uuid);
  }

  return '';
}

/**
 * 작은 머리 이미지 URL
 *
 * 정책:
 * - profile / header / 연동 확인 모달에서 전부 이 계열 이미지를 사용
 * - 현재 프로젝트에서 "대표 마크 프로필 이미지"는 이 함수가 담당
 *
 * MCHeads head API 예:
 * https://mc-heads.net/avatar/Notch/64
 */
export function buildMinecraftAvatarUrl(
  uuidOrUsername: string,
  size = 64,
): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(uuidOrUsername)}/${size}`;
}

/**
 * head render 성격의 URL
 *
 * 현재 UI에서는 avatarUrl과 동일하게 써도 충분하지만,
 * 기존 코드와의 호환을 위해 별도 함수명을 유지한다.
 */
export function buildMinecraftHeadRenderUrl(
  uuidOrUsername: string,
  size = 64,
): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(uuidOrUsername)}/${size}`;
}

/**
 * body render URL
 *
 * 현재 UI에서는 사실상 쓰지 않지만,
 * 기존 API 구조를 깨지 않기 위해 유지한다.
 * MCHeads의 body 렌더 계열 URL로 맞춘다.
 */
export function buildMinecraftBodyRenderUrl(
  uuidOrUsername: string,
  size = 128,
): string {
  return `https://mc-heads.net/body/${encodeURIComponent(uuidOrUsername)}/${size}`;
}

/**
 * 원본 skin PNG 다운로드 URL
 *
 * 현재 UI에서는 직접 쓰지 않지만,
 * 조회 응답 구조 유지 목적상 남겨둔다.
 */
export function buildMinecraftSkinUrl(uuidOrUsername: string): string {
  return `https://mc-heads.net/skin/${encodeURIComponent(uuidOrUsername)}`;
}

/**
 * 프로필에 저장된 값으로 "사이트 표시용 머리 이미지"를 만들 때 쓰는 헬퍼
 *
 * 사용 예:
 * - 프로필 카드
 * - 헤더
 * - 현재 연동 정보 표시
 */
export function buildStoredMinecraftHeadUrl(params: {
  username?: string | null;
  uuid?: string | null;
  size?: number;
}): string | null {
  const identifier = resolveMinecraftIdentifier(params.username, params.uuid);

  if (!identifier) return null;

  return buildMinecraftAvatarUrl(identifier, params.size ?? 64);
}

export function getMinecraftStatusMeta(
  status: MinecraftLinkStatus | null | undefined,
) {
  switch (status) {
    case 'verified':
      return {
        label: '인증됨',
        className:
          'rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700',
      };

    case 'linked':
      return {
        label: '연동됨',
        className:
          'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700',
      };

    case 'needs_lookup':
    default:
      return {
        label: '조회 필요',
        className:
          'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700',
      };
  }
}