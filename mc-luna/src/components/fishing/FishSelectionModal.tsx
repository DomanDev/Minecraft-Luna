"use client";

import Image from "next/image";
import {
  APP_MIN_FISH_SELECTION,
  FISH_ICON_MAP,
  FISH_NAME_MAP,
  type FishingBiomeKey,
} from "@/src/lib/fishing/fishBiome";

type FishSelectionModalProps = {
  open: boolean;
  biome: FishingBiomeKey;
  fishKeys: string[];
  selectedKeys: string[];
  onToggle: (fishKey: string) => void;
  onApply: () => void;
  onClose: () => void;
  disabled?: boolean;
};

export default function FishSelectionModal({
  open,
  biome,
  fishKeys,
  selectedKeys,
  onToggle,
  onApply,
  onClose,
  disabled = false,
}: FishSelectionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">물고기 설정</h2>
            <p className="text-sm text-zinc-500">
              현재 바이옴: {biome} / 최소 {APP_MIN_FISH_SELECTION}마리 이상 선택 필요
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

        <div className="grid grid-cols-5 gap-3">
          {fishKeys.map((fishKey) => {
            const selected = selectedKeys.includes(fishKey);
            return (
              <button
                key={fishKey}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(fishKey)}
                className={[
                  "flex min-h-[112px] flex-col items-center justify-center rounded-xl border p-3 text-center transition",
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

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            선택됨: {selectedKeys.length} / {fishKeys.length}
          </p>

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
  );
}