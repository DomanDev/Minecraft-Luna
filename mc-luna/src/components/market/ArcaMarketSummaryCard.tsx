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
    <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">아르카 최근 시세</div>
          <div className="mt-1 text-xs text-emerald-100">
            최근 완료 거래 20건 기준
          </div>
        </div>

        <Link
          href="/arca-market"
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
        >
          거래소 가기
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-emerald-50">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="mt-4 text-sm text-emerald-50">
          완료된 거래 없음
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-[11px] text-emerald-100">평균 비율</div>
            <div className="mt-1 text-lg font-bold text-white">
              {summary.averageRatio}:1
            </div>
          </div>

          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-[11px] text-emerald-100">거래 수</div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatNumber(summary.tradeCount)}건
            </div>
          </div>

          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-[11px] text-emerald-100">거래량</div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatNumber(summary.totalArca)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}