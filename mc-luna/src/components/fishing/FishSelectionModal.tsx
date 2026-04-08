"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  APP_MIN_FISH_SELECTION,
  FISH_ICON_MAP,
  FISH_NAME_MAP,
  FISHING_BIOME_OPTIONS,
  type FishingBiomeKey,
} from "@/src/lib/fishing/fishBiome";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";

type FishSelectionModalProps = {
  open: boolean;
  biome: FishingBiomeKey;
  fishKeys: string[];
  selectedKeys: string[];
  fishPrices: Record<string, number>;
  buildFishPriceEditKey: (itemKey: string, grade: "normal" | "advanced" | "rare") => string;
  onToggle: (fishKey: string) => void;
  onResetSelection: () => void;
  onPriceChange: (fishKey: string, grade: "normal" | "advanced" | "rare", value: number) => void;
  onSavePrices?: () => void;
  isProUser: boolean;
  savingFishPrices?: boolean;
  onApply: () => void;
  onClose: () => void;
  disabled?: boolean;
};

type FishModalTab = "select" | "prices";

export default function FishSelectionModal({
  open,
  biome,
  fishKeys,
  selectedKeys,
  fishPrices,
  buildFishPriceEditKey,
  onToggle,
  onResetSelection,
  onPriceChange,
  onSavePrices,
  isProUser,
  savingFishPrices = false,
  onApply,
  onClose,
  disabled = false,
}: FishSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<FishModalTab>("select");

  const selectedFishKeys = useMemo(() => {
    return fishKeys.filter((fishKey) => selectedKeys.includes(fishKey));
  }, [fishKeys, selectedKeys]);

  const biomeLabel =
    FISHING_BIOME_OPTIONS.find((item) => item.value === biome)?.label ?? biome;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">물고기 설정</h2>
              <p className="mt-1 text-sm text-zinc-500">
                현재 바이옴: {biomeLabel} / 최소 {APP_MIN_FISH_SELECTION}마리 이상 선택 필요
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              닫기
            </button>
          </div>

          {/* 탭 */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("select")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                activeTab === "select"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
              ].join(" ")}
            >
              물고기 선택
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("prices")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                activeTab === "prices"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
              ].join(" ")}
            >
              물고기 시세
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "select" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-sm text-zinc-600">
                  선택됨: <span className="font-semibold text-zinc-900">{selectedKeys.length}</span> /{" "}
                  {fishKeys.length}
                </p>

                <button
                  type="button"
                  onClick={onResetSelection}
                  disabled={disabled}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    disabled
                      ? "cursor-not-allowed bg-zinc-200 text-zinc-400"
                      : "bg-zinc-900 text-white hover:bg-zinc-700",
                  ].join(" ")}
                >
                  초기화
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {fishKeys.map((fishKey) => {
                  const selected = selectedKeys.includes(fishKey);

                  return (
                    <button
                      key={fishKey}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggle(fishKey)}
                      className={[
                        "flex min-h-[116px] flex-col items-center justify-center rounded-xl border p-3 text-center transition",
                        selected
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                          : "border-zinc-200 bg-white hover:bg-zinc-50",
                        disabled ? "cursor-not-allowed opacity-50" : "",
                      ].join(" ")}
                    >
                      <div className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-zinc-100">
                        {FISH_ICON_MAP[fishKey] ? (
                          <Image
                            src={FISH_ICON_MAP[fishKey]}
                            alt={FISH_NAME_MAP[fishKey]}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        ) : null}
                      </div>

                      <div className="text-sm font-semibold text-zinc-900">
                        {FISH_NAME_MAP[fishKey]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                현재 선택된 물고기만 시세 입력이 가능합니다. 평균값은 메인 화면의 평균 시세 칸에 자동 반영됩니다.
              </div>

              {selectedFishKeys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                  선택된 물고기가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedFishKeys.map((fishKey) => (
                    <div
                      key={fishKey}
                      className="rounded-xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-zinc-100">
                          {FISH_ICON_MAP[fishKey] ? (
                            <Image
                              src={FISH_ICON_MAP[fishKey]}
                              alt={FISH_NAME_MAP[fishKey]}
                              width={40}
                              height={40}
                              className="object-contain"
                            />
                          ) : null}
                        </div>

                        <div>
                          <div className="font-semibold text-zinc-900">{FISH_NAME_MAP[fishKey]}</div>
                          <div className="text-xs text-zinc-500">{biomeLabel}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="일반">
                          <NumberInput
                            value={fishPrices[buildFishPriceEditKey(fishKey, "normal")] ?? 0}
                            min={0}
                            onChange={(value) => onPriceChange(fishKey, "normal", value)}
                          />
                        </Field>

                        <Field label="고급">
                          <NumberInput
                            value={fishPrices[buildFishPriceEditKey(fishKey, "advanced")] ?? 0}
                            min={0}
                            onChange={(value) => onPriceChange(fishKey, "advanced", value)}
                          />
                        </Field>

                        <Field label="희귀">
                          <NumberInput
                            value={fishPrices[buildFishPriceEditKey(fishKey, "rare")] ?? 0}
                            min={0}
                            onChange={(value) => onPriceChange(fishKey, "rare", value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-zinc-200 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {isProUser ? (
                <button
                  type="button"
                  onClick={onSavePrices}
                  disabled={savingFishPrices}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {savingFishPrices ? "시세 저장 중..." : "물고기 시세 저장"}
                </button>
              ) : (
                <span className="text-xs text-zinc-500">물고기 시세 저장은 Pro 전용</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-100"
              >
                취소
              </button>

              <button
                type="button"
                onClick={onApply}
                className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}