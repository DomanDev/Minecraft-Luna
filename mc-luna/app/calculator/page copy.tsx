"use client";

import { useMemo, useState } from "react";

import { calculateFishing } from "../../src/lib/fishing/calc";
import type {
  BaitType,
  GroundbaitType,
  PondState,
  TimeOfDay,
} from "../../src/lib/fishing/types";

/**
 * select 옵션용 데이터
 * label은 화면 표시용
 * value는 실제 계산용
 */
const baitOptions: { value: BaitType; label: string; description: string }[] = [
  { value: "none", label: "없음", description: "미끼 미사용" },
  { value: "worm", label: "지렁이 미끼", description: "기척 -5%, 입질 -3%, 고급 +20, 희귀 +10" },
  { value: "meal", label: "어분 미끼", description: "기척 -10%, 입질 -5%, 고급 +30, 희귀 +15" },
  { value: "lure", label: "루어 미끼", description: "기척 -15%, 입질 -10%, 고급 +40, 희귀 +30" },
];

const groundbaitOptions: {
  value: GroundbaitType;
  label: string;
  description: string;
}[] = [
  { value: "none", label: "없음", description: "떡밥 미사용" },
  { value: "plain", label: "평범한 떡밥", description: "기척 -2%" },
  { value: "good", label: "잘만든 떡밥", description: "기척 -2%, 입질 -3%" },
  { value: "rainbow", label: "무지개 떡밥", description: "기척 -5%, 입질 -5%" },
];

export default function CalculatorPage() {
  /**
   * 기본값은 네가 테스트하기 쉽게 적당한 예시로 넣어둠
   * 실제로는 나중에 /profile에서 자동 주입 가능
   */
  const [luck, setLuck] = useState(23);
  const [sense, setSense] = useState(0.5);

  const [rumoredBait, setRumoredBait] = useState(20);
  const [lineTension, setLineTension] = useState(10);
  const [doubleHook, setDoubleHook] = useState(0);
  const [schoolFishing, setSchoolFishing] = useState(0);

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [pondState, setPondState] = useState<PondState>("abundant");

  const [baitType, setBaitType] = useState<BaitType>("none");
  const [groundbaitType, setGroundbaitType] = useState<GroundbaitType>("none");
  const [lureEnchantLevel, setLureEnchantLevel] = useState(0);

  const [useDoubleHook, setUseDoubleHook] = useState(false);
  const [useSchoolFishing, setUseSchoolFishing] = useState(false);

  const [normalPrice, setNormalPrice] = useState(100);
  const [advancedPrice, setAdvancedPrice] = useState(250);
  const [rarePrice, setRarePrice] = useState(800);

  /**
   * 입력값이 바뀔 때마다 계산 결과 다시 생성
   */
  const result = useMemo(() => {
    return calculateFishing({
      stats: {
        luck,
        sense,
      },
      skills: {
        rumoredBait,
        lineTension,
        doubleHook,
        schoolFishing,
      },
      environment: {
        timeOfDay,
        pondState,
        baitType,
        groundbaitType,
        lureEnchantLevel,
        useDoubleHook,
        useSchoolFishing,
      },
      prices: {
        normal: normalPrice,
        advanced: advancedPrice,
        rare: rarePrice,
      },
    });
  }, [
    luck,
    sense,
    rumoredBait,
    lineTension,
    doubleHook,
    schoolFishing,
    timeOfDay,
    pondState,
    baitType,
    groundbaitType,
    lureEnchantLevel,
    useDoubleHook,
    useSchoolFishing,
    normalPrice,
    advancedPrice,
    rarePrice,
  ]);

  const selectedBait = baitOptions.find((item) => item.value === baitType);
  const selectedGroundbait = groundbaitOptions.find(
    (item) => item.value === groundbaitType,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">낚시 예상 수익 계산기</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 왼쪽: 입력 영역 */}
        <section className="space-y-6 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">입력값</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="행운"
              value={luck}
              onChange={setLuck}
              step={0.1}
            />
            <NumberField
              label="감각"
              value={sense}
              onChange={setSense}
              step={0.1}
            />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">낚시 스킬</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="소문난 미끼 레벨"
                value={rumoredBait}
                onChange={setRumoredBait}
                min={0}
                max={30}
              />
              <NumberField
                label="낚싯줄 장력 레벨"
                value={lineTension}
                onChange={setLineTension}
                min={0}
                max={30}
              />
              <NumberField
                label="쌍걸이 레벨"
                value={doubleHook}
                onChange={setDoubleHook}
                min={0}
                max={30}
              />
              <NumberField
                label="떼낚시 레벨"
                value={schoolFishing}
                onChange={setSchoolFishing}
                min={0}
                max={30}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">환경</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="시간대"
                value={timeOfDay}
                onChange={(v) => setTimeOfDay(v as TimeOfDay)}
                options={[
                  { value: "day", label: "낮" },
                  { value: "night", label: "밤" },
                ]}
              />

              <SelectField
                label="어장 상태"
                value={pondState}
                onChange={(v) => setPondState(v as PondState)}
                options={[
                  { value: "abundant", label: "풍부" },
                  { value: "normal", label: "보통" },
                  { value: "depleted", label: "고갈" },
                ]}
              />

              <SelectField
                label="미끼 종류"
                value={baitType}
                onChange={(v) => setBaitType(v as BaitType)}
                options={baitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <SelectField
                label="떡밥 종류"
                value={groundbaitType}
                onChange={(v) => setGroundbaitType(v as GroundbaitType)}
                options={groundbaitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <NumberField
                label="미끼 인챈트 레벨 (Lure)"
                value={lureEnchantLevel}
                onChange={setLureEnchantLevel}
                min={0}
                max={3}
              />
            </div>

            <div className="rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
              <p>
                <span className="font-semibold">선택한 미끼:</span>{" "}
                {selectedBait?.description}
              </p>
              <p className="mt-2">
                <span className="font-semibold">선택한 떡밥:</span>{" "}
                {selectedGroundbait?.description}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">액티브 스킬 사용 여부</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <CheckboxField
                label="쌍걸이 사용"
                checked={useDoubleHook}
                onChange={setUseDoubleHook}
              />

              <CheckboxField
                label="떼낚시 사용"
                checked={useSchoolFishing}
                onChange={setUseSchoolFishing}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">물고기 시세</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="일반 가격"
                value={normalPrice}
                onChange={setNormalPrice}
                min={0}
              />
              <NumberField
                label="고급 가격"
                value={advancedPrice}
                onChange={setAdvancedPrice}
                min={0}
              />
              <NumberField
                label="희귀 가격"
                value={rarePrice}
                onChange={setRarePrice}
                min={0}
              />
            </div>
          </div>
        </section>

        {/* 오른쪽: 결과 영역 */}
        <section className="space-y-6 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">계산 결과</h2>

          <ResultCard
            title="1회 낚시 시간"
            rows={[
              [
                "표시 기척 시간(인챈트 미적용)",
                `${result.catchTime.displayNibbleSeconds.toFixed(2)}초 (${result.catchTime.displayNibbleTicks.toFixed(2)}틱)`,
              ],
              [
                "표시 입질 시간(인챈트 미적용)",
                `${result.catchTime.displayBiteSeconds.toFixed(2)}초 (${result.catchTime.displayBiteTicks.toFixed(2)}틱)`,
              ],
              [
                "실제 기척 시간(인챈트 적용)",
                `${result.catchTime.finalNibbleSeconds.toFixed(2)}초 (${result.catchTime.finalNibbleTicks.toFixed(2)}틱)`,
              ],
              [
                "실제 입질 시간(인챈트 적용)",
                `${result.catchTime.finalBiteSeconds.toFixed(2)}초 (${result.catchTime.finalBiteTicks.toFixed(2)}틱)`,
              ],
              [
                "총 1회 시간",
                `${result.catchTime.totalCycleSeconds.toFixed(2)}초`,
              ],
            ]}
          />

          <ResultCard
            title="등급 확률"
            rows={[
              [
                "일반",
                `${(result.gradeRatio.probabilityNormal * 100).toFixed(2)}%`,
              ],
              [
                "고급",
                `${(result.gradeRatio.probabilityAdvanced * 100).toFixed(2)}%`,
              ],
              [
                "희귀",
                `${(result.gradeRatio.probabilityRare * 100).toFixed(2)}%`,
              ],
            ]}
          />

          <ResultCard
            title="기대 획득량"
            rows={[
              [
                "기본 획득량",
                `${result.catchExpectation.baseFishPerCycle.toFixed(3)}개`,
              ],
              [
                "소문난 미끼 반영 후",
                `${result.catchExpectation.afterRumoredBaitFishPerCycle.toFixed(3)}개`,
              ],
              [
                "최종 기대 획득량",
                `${result.catchExpectation.finalFishPerCycle.toFixed(3)}개`,
              ],
            ]}
          />

          <ResultCard
            title="기대 수익"
            rows={[
              [
                "물고기 1개 기대가치",
                `${Math.round(result.value.expectedValuePerFish).toLocaleString()}`,
              ],
              [
                "1회 기대 수익",
                `${Math.round(result.value.expectedValuePerCycle).toLocaleString()}`,
              ],
              [
                "시간당 기대 수익",
                `${Math.round(result.value.expectedValuePerHour).toLocaleString()}`,
              ],
            ]}
          />

          <ResultCard
            title="기타 정보"
            rows={[
              [
                "바닐라 결과물 확률",
                `${result.value.vanillaChancePercent.toFixed(2)}%`,
              ],
              [
                "커스텀 물고기 확률",
                `${result.value.customFishChancePercent.toFixed(2)}%`,
              ],
            ]}
          />

          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">
              단계별 계산값 / 디버그 JSON 보기
            </summary>

            <pre className="mt-4 overflow-x-auto rounded-lg bg-black p-4 text-sm text-white">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}

/**
 * 숫자 입력 컴포넌트
 */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
      />
    </label>
  );
}

/**
 * select 입력 컴포넌트
 */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 체크박스 입력 컴포넌트
 */
function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

/**
 * 결과 카드 컴포넌트
 */
function ResultCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>

      <div className="space-y-2">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-neutral-500">{key}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}