"use client";

import { useState } from "react";
import { supabase } from "../../src/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleDiscordLogin = async () => {
    try {
      setLoading(true);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/profile`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo,
        },
      });

      if (error) {
        alert(error.message);
        setLoading(false);
      }
    } catch (error) {
      console.error("Discord 로그인 시작 중 예외:", error);
      alert("Discord 로그인 시작 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-140px)] max-w-3xl items-center px-4 py-12">
      <section className="w-full rounded-2xl border bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">로그인</h1>
          <p className="text-sm text-gray-600">
            이제 루나 웹 서비스는 Discord 계정으로 로그인합니다.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          <div className="font-semibold">안내</div>
          <p className="mt-1">
            로그인 후 프로필 페이지에서 마인크래프트 닉네임을 조회하고 연동할 수 있습니다.
          </p>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#5865F2] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Discord 로그인 이동 중..." : "Discord로 로그인"}
          </button>
        </div>
      </section>
    </main>
  );
}