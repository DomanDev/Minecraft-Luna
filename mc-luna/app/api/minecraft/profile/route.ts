import { NextRequest, NextResponse } from "next/server";
import {
  buildMinecraftAvatarUrl,
  buildMinecraftBodyRenderUrl,
  buildMinecraftHeadRenderUrl,
  buildMinecraftSkinUrl,
  normalizeMinecraftUuid,
} from "@/src/lib/minecraft-profile";

/**
 * 마인크래프트 Java 닉네임 -> UUID 조회 API
 *
 * 프론트에서 직접 Mojang을 치지 않고
 * 서버 라우트를 통해 조회 결과를 정리해서 내려준다.
 */
export async function GET(request: NextRequest) {
  const nickname = request.nextUrl.searchParams.get("nickname")?.trim() ?? "";

  if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname)) {
    return NextResponse.json(
      { error: "닉네임은 3~16자의 영문, 숫자, 밑줄(_)만 사용할 수 있습니다." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(nickname)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.status === 204) {
      return NextResponse.json(
        { error: "존재하지 않는 마인크래프트 닉네임입니다." },
        { status: 404 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "마인크래프트 프로필 조회에 실패했습니다." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      id: string;
      name: string;
    };

    const uuid = normalizeMinecraftUuid(data.id);

    return NextResponse.json({
      nickname: data.name,
      uuid,
      avatarUrl: buildMinecraftAvatarUrl(uuid, 96),
      headUrl: buildMinecraftHeadRenderUrl(uuid, 6),
      bodyRenderUrl: buildMinecraftBodyRenderUrl(uuid, 6),
      skinUrl: buildMinecraftSkinUrl(uuid),
    });
  } catch (error) {
    console.error("마인크래프트 프로필 조회 중 예외:", error);

    return NextResponse.json(
      { error: "마인크래프트 프로필 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}