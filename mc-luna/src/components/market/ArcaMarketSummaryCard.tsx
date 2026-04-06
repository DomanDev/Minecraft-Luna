"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

type ArcaTradeSummaryRow = {
  id: string;
  ratio: number;
  arca_amount: number;
  completed_at: string | null;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function ArcaMarketSummaryCard() {
  const [rows, setRows] = useState<ArcaTradeSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchSummary() {
      try {
        const { data, error } = await supabase
          .from("arca_trade_posts")
          .select("id, ratio, arca_amount, completed_at")
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(20);

        if (error) {
          console.warn("아르카 시세 요약 조회 실패:", error.message);
          if (mounted) {
            setRows([]);
          }
          return;
        }

        if (mounted) {
          setRows((data ?? []) as ArcaTradeSummaryRow[]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void fetchSummary();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        averageRatio: 0,
        totalArca: 0,
        tradeCount: 0,
      };
    }

    const totalRatio = rows.reduce((sum, row) => sum + Number(row.ratio ?? 0), 0);
    const totalArca = rows.reduce((sum, row) => sum + Number(row.arca_amount ?? 0), 0);

    return {
      averageRatio: Math.round((totalRatio / rows.length) * 100) / 100,
      totalArca,
      tradeCount: rows.length,
    };
  }, [rows]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-zinc-100 p-5 shadow-sm ring-1 ring-slate-100">
      {/* =========================
          카드 상단 헤더
          - 기존 초록 반투명 스타일 제거
          - 실버/슬레이트 톤 중심으로 정리
      ========================= */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-600 shadow-sm">
            ARCA MARKET
          </div>

          <div className="mt-3 text-lg font-bold tracking-tight text-slate-900">
            아르카 최근 시세
          </div>

          <div className="mt-1 text-sm text-slate-600">
            최근 완료 거래 20건 기준 요약
          </div>
        </div>

        <Link
          href="/arca-market"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          거래소 가기
        </Link>
      </div>

      {/* =========================
          로딩 / 빈 데이터 상태
      ========================= */}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          완료된 거래 없음
        </div>
      ) : (
        /* =========================
            통계 카드 3칸
            - 색을 강하게 쓰지 않고
            - 흰색/실버톤 카드 + 진한 텍스트로 정리
        ========================= */
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              평균 비율
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {summary.averageRatio}:1
            </div>
            <div className="mt-1 text-xs text-slate-500">
              최근 완료 거래 평균값
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              거래 수
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {formatNumber(summary.tradeCount)}
              <span className="ml-1 text-sm font-bold text-slate-500">건</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              최근 집계된 완료 거래 수
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold tracking-wide text-slate-500">
              거래량
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {formatNumber(summary.totalArca)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              최근 완료 거래 총 아르카
            </div>
          </div>
        </div>
      )}
    </div>
  );
}