export type MinecraftLinkStatus = "needs_lookup" | "linked" | "verified";

export type MinecraftLookupResult = {
  nickname: string;
  uuid: string;
  avatarUrl: string;
  headUrl: string;
  bodyRenderUrl: string;
};

export function normalizeMinecraftUuid(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

export function buildMinecraftAvatarUrl(uuid: string, size = 64): string {
  return `https://crafatar.com/avatars/${normalizeMinecraftUuid(uuid)}?size=${size}&overlay`;
}

export function buildMinecraftHeadRenderUrl(uuid: string, scale = 5): string {
  return `https://crafatar.com/renders/head/${normalizeMinecraftUuid(uuid)}?scale=${scale}&overlay`;
}

export function buildMinecraftBodyRenderUrl(uuid: string, scale = 5): string {
  return `https://crafatar.com/renders/body/${normalizeMinecraftUuid(uuid)}?scale=${scale}&overlay`;
}

export function getMinecraftStatusMeta(status: MinecraftLinkStatus | null | undefined) {
  switch (status) {
    case "verified":
      return {
        label: "인증됨",
        className:
          "rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700",
      };

    case "linked":
      return {
        label: "연동됨",
        className:
          "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700",
      };

    case "needs_lookup":
    default:
      return {
        label: "조회 필요",
        className:
          "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700",
      };
  }
}