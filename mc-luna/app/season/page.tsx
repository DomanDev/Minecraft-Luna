"use client";

import { useEffect, useMemo, useState } from "react";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import SelectInput from "@/src/components/calculator/SelectInput";
import ResultCard from "@/src/components/calculator/ResultCard";
import {
  VILLAGE_OPTIONS,
  formatIngameDate,
  formatRemainingTime,
  getSeasonState,
  type VillageKey,
} from "@/src/lib/season/calc";

function getSeasonVisual(season: string, isCurrent: boolean) {
  switch (season) {
    case "봄":
      return {
        icon: "🌸",
        cardClass: isCurrent
          ? "border-pink-300 bg-pink-50 shadow-sm"
          : "border-pink-200 bg-pink-50/60",
        titleClass: isCurrent ? "text-pink-700" : "text-pink-600",
        valueClass: isCurrent ? "text-pink-900" : "text-zinc-900",
      };
    case "여름":
      return {
        icon: "☀️",
        cardClass: isCurrent
          ? "border-amber-300 bg-amber-50 shadow-sm"
          : "border-amber-200 bg-amber-50/60",
        titleClass: isCurrent ? "text-amber-700" : "text-amber-600",
        valueClass: isCurrent ? "text-amber-900" : "text-zinc-900",
      };
    case "가을":
      return {
        icon: "🍂",
        cardClass: isCurrent
          ? "border-orange-300 bg-orange-50 shadow-sm"
          : "border-orange-200 bg-orange-50/60",
        titleClass: isCurrent ? "text-orange-700" : "text-orange-600",
        valueClass: isCurrent ? "text-orange-900" : "text-zinc-900",
      };
    case "겨울":
      return {
        icon: "❄️",
        cardClass: isCurrent
          ? "border-sky-300 bg-sky-50 shadow-sm"
          : "border-sky-200 bg-sky-50/60",
        titleClass: isCurrent ? "text-sky-700" : "text-sky-600",
        valueClass: isCurrent ? "text-sky-900" : "text-zinc-900",
      };
    default:
      return {
        icon: "🕒",
        cardClass: isCurrent
          ? "border-emerald-300 bg-emerald-50 shadow-sm"
          : "border-zinc-200 bg-white",
        titleClass: "text-zinc-600",
        valueClass: "text-zinc-900",
      };
  }
}

function SeasonStatusCard({
  season,
  isCurrent,
  remainingMinutes,
}: {
  season: string;
  isCurrent: boolean;
  remainingMinutes: number;
}) {
  const visual = getSeasonVisual(season, isCurrent);

    return (
    <div
      className={`rounded-2xl border p-4 min-h-[92px] transition-all ${visual.cardClass} ${
        isCurrent ? "ring-2 ring-offset-1 ring-white/70" : ""
      }`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${visual.titleClass}`}>
        <span className="text-base leading-none">{visual.icon}</span>
        <span>{season}</span>
      </div>

      <div
        className={`mt-3 text-sm sm:text-base font-bold leading-snug whitespace-nowrap ${visual.valueClass}`}
      >
        {isCurrent
          ? "현재 계절"
          : `${formatRemainingTime(remainingMinutes)} 후`}
      </div>
    </div>
  );
}

function buildSeasonSummaryRows(
  villageLabel: string,
  currentSeason: string,
  currentTimeText: string,
): [string, string][] {
  return [
    ["선택한 마을", villageLabel],
    ["현재 계절", currentSeason],
    ["현재 시각", currentTimeText],
  ];
}

export default function SeasonPage() {
  const [village, setVillage] = useState<VillageKey>("aries");
  const [seasonState, setSeasonState] = useState(() => getSeasonState("aries"));

  useEffect(() => {
    const update = () => {
      setSeasonState(getSeasonState(village));
    };

    update();

    /**
     * 현실 1초 = 인게임 1분
     * 초는 표시하지 않더라도 1초마다 갱신하는 편이 자연스럽다.
     */
    const timer = window.setInterval(update, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [village]);

  const currentTimeText = useMemo(() => {
    return formatIngameDate(
      seasonState.ingameMonth,
      seasonState.ingameDay,
      seasonState.ingameHour,
      seasonState.ingameMinute,
    );
  }, [
    seasonState.ingameMonth,
    seasonState.ingameDay,
    seasonState.ingameHour,
    seasonState.ingameMinute,
  ]);

  const summaryRows = useMemo(() => {
    return buildSeasonSummaryRows(
      seasonState.villageLabel,
      seasonState.currentSeason,
      currentTimeText,
    );
  }, [seasonState.villageLabel, seasonState.currentSeason, currentTimeText]);

  return (
    <CalculatorLayout
      title="계절 계산기"
      left={
        <CalculatorPanel title="설정">
          <div className="space-y-4">
            <Field
              label="현재 위치한 마을"
              hint="현재 서 있는 마을을 선택하면 계절과 남은 시간을 계산합니다."
            >
              <SelectInput
                value={village}
                onChange={(value) => setVillage(value as VillageKey)}
                options={VILLAGE_OPTIONS}
              />
            </Field>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-zinc-600">현재 마을</div>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {seasonState.villageLabel}
              </div>

              <div className="mt-4 text-sm text-zinc-600">현재 계절</div>
              <div className="mt-1 text-2xl font-bold text-zinc-900">
                {seasonState.currentSeason}
              </div>

              <div className="mt-4 text-sm text-zinc-600">현재 인게임 시각</div>
              <div className="mt-1 text-base font-semibold text-zinc-800">
                {currentTimeText}
              </div>
            </div>

            <p className="text-xs leading-5 text-zinc-500">
              기준 규칙: 현실 1분 = 인게임 1시간, 계절 1개 = 인게임 30일
            </p>
          </div>
        </CalculatorPanel>
      }
      right={
        <div className="space-y-6">
          <ResultCard title="계절 남은 시간">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {seasonState.items.map((item) => (
                <SeasonStatusCard
                  key={item.season}
                  season={item.season}
                  isCurrent={item.isCurrent}
                  remainingMinutes={item.remainingMinutes}
                />
              ))}
            </div>
          </ResultCard>

          <ResultCard title="요약">
            <div className="space-y-2 text-sm text-zinc-700">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </ResultCard>
        </div>
      }
    />
  );
}