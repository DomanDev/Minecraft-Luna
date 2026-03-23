"use client";

import { useState } from "react";
import { calculateFishing } from "../../src/lib/fishing/calc";
import type {
  BaitType,
  GroundbaitType,
  PondState,
  TimeOfDay,
  ThirstMin,
  FishingCalculationInput,
  FishingCalculationResult,
} from "../../src/lib/fishing/types";

/**
 * 미끼 선택 옵션
 * label: 화면에 보이는 이름
 * description: 선택 시 하단 안내 문구에 표시할 설명
 */
const baitOptions: { value: BaitType; label: string; description: string }[] = [
  { value: "none", label: "없음", description: "미끼 미사용" },
  {
    value: "worm",
    label: "지렁이 미끼",
    description: "기척 -5%, 입질 -3%, 고급 +20, 희귀 +10",
  },
  {
    value: "meal",
    label: "어분 미끼",
    description: "기척 -10%, 입질 -5%, 고급 +30, 희귀 +15",
  },
  {
    value: "lure",
    label: "루어 미끼",
    description: "기척 -15%, 입질 -10%, 고급 +40, 희귀 +30",
  },
];

/**
 * 떡밥 선택 옵션
 */
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

/**
 * 초기 입력값
 * - 페이지 첫 진입 시 보여줄 기본값
 * - 이후 result의 초기 계산에도 동일하게 사용
 */
const INITIAL_FORM = {
  luck: 23,
  sense: 26,

  rumoredBait: 20,
  lineTension: 10,
  doubleHook: 0,
  schoolFishing: 0,

  timeOfDay: "day" as TimeOfDay,
  pondState: "abundant" as PondState,

  baitType: "none" as BaitType,
  groundbaitType: "none" as GroundbaitType,
  lureEnchantLevel: 3,
  thirstMin: 10 as ThirstMin, // 기본값: 보통 10 이하에서 주스 마시는 플레이 기준

  useDoubleHook: false,
  useSchoolFishing: false,

  normalPrice: 8,
  advancedPrice: 20,
  rarePrice: 27,
};

/**
 * 초기 result 계산용 입력 객체 생성 함수
 * 컴포넌트 바깥에 둬서 최초 useState 초기값에 안전하게 사용
 */
function createInitialCalculationInput(): FishingCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
    },
    skills: {
      rumoredBait: INITIAL_FORM.rumoredBait,
      lineTension: INITIAL_FORM.lineTension,
      doubleHook: INITIAL_FORM.doubleHook,
      schoolFishing: INITIAL_FORM.schoolFishing,
    },
    environment: {
      timeOfDay: INITIAL_FORM.timeOfDay,
      pondState: INITIAL_FORM.pondState,
      baitType: INITIAL_FORM.baitType,
      groundbaitType: INITIAL_FORM.groundbaitType,
      lureEnchantLevel: INITIAL_FORM.lureEnchantLevel,
      thirstMin: INITIAL_FORM.thirstMin,
      useDoubleHook: INITIAL_FORM.useDoubleHook,
      useSchoolFishing: INITIAL_FORM.useSchoolFishing,
    },
    prices: {
      normal: INITIAL_FORM.normalPrice,
      advanced: INITIAL_FORM.advancedPrice,
      rare: INITIAL_FORM.rarePrice,
    },
  };
}

export default function CalculatorPage() {
  /**
   * =========================
   * 입력 폼 state
   * =========================
   */
  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  const [rumoredBait, setRumoredBait] = useState(INITIAL_FORM.rumoredBait);
  const [lineTension, setLineTension] = useState(INITIAL_FORM.lineTension);
  const [doubleHook, setDoubleHook] = useState(INITIAL_FORM.doubleHook);
  const [schoolFishing, setSchoolFishing] = useState(INITIAL_FORM.schoolFishing);

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(INITIAL_FORM.timeOfDay);
  const [pondState, setPondState] = useState<PondState>(INITIAL_FORM.pondState);

  const [baitType, setBaitType] = useState<BaitType>(INITIAL_FORM.baitType);
  const [groundbaitType, setGroundbaitType] = useState<GroundbaitType>(
    INITIAL_FORM.groundbaitType,
  );
  const [lureEnchantLevel, setLureEnchantLevel] = useState(
    INITIAL_FORM.lureEnchantLevel,
  );
  const [thirstMin, setThirstMin] = useState<ThirstMin>(INITIAL_FORM.thirstMin);
  const [useDoubleHook, setUseDoubleHook] = useState(INITIAL_FORM.useDoubleHook);
  const [useSchoolFishing, setUseSchoolFishing] = useState(
    INITIAL_FORM.useSchoolFishing,
  );

  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  /**
   * =========================
   * 결과 state
   * =========================
   * 자동 계산(useMemo) 대신,
   * 버튼 클릭 시에만 갱신되도록 별도 state로 관리
   */
  const [result, setResult] = useState<FishingCalculationResult>(() =>
    calculateFishing(createInitialCalculationInput()),
  );

  /**
   * 사용자가 입력값을 바꿨지만 아직 "계산하기"를 누르지 않은 상태인지 표시
   * true면 현재 결과가 최신 입력값과 다를 수 있다는 뜻
   */
  const [isDirty, setIsDirty] = useState(false);

  /**
   * 현재 폼 입력값을 계산기 입력 객체로 묶어주는 함수
   * 버튼 클릭 시 이 함수 결과를 calculateFishing에 넣으면 됨
   */
  const buildCalculationInput = (): FishingCalculationInput => {
    return {
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
        thirstMin,
        useDoubleHook,
        useSchoolFishing,
      },
      prices: {
        normal: normalPrice,
        advanced: advancedPrice,
        rare: rarePrice,
      },
    };
  };

  /**
   * 계산 버튼 클릭 시 실행
   * 현재 입력값 기준으로 계산 후 결과 state 갱신
   */
  const handleCalculate = () => {
    const nextResult = calculateFishing(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  };

  /**
   * 현재 입력값을 모두 초기값으로 되돌리는 버튼이 필요할 경우를 대비한 함수
   * 지금 UI에 바로 쓰지는 않아도, 나중에 쉽게 추가 가능
   */
  const handleReset = () => {
    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);

    setRumoredBait(INITIAL_FORM.rumoredBait);
    setLineTension(INITIAL_FORM.lineTension);
    setDoubleHook(INITIAL_FORM.doubleHook);
    setSchoolFishing(INITIAL_FORM.schoolFishing);

    setTimeOfDay(INITIAL_FORM.timeOfDay);
    setPondState(INITIAL_FORM.pondState);

    setBaitType(INITIAL_FORM.baitType);
    setGroundbaitType(INITIAL_FORM.groundbaitType);
    setLureEnchantLevel(INITIAL_FORM.lureEnchantLevel);
    setThirstMin(INITIAL_FORM.thirstMin);

    setUseDoubleHook(INITIAL_FORM.useDoubleHook);
    setUseSchoolFishing(INITIAL_FORM.useSchoolFishing);

    setNormalPrice(INITIAL_FORM.normalPrice);
    setAdvancedPrice(INITIAL_FORM.advancedPrice);
    setRarePrice(INITIAL_FORM.rarePrice);

    setResult(calculateFishing(createInitialCalculationInput()));
    setIsDirty(false);
  };

  /**
   * 현재 선택된 미끼/떡밥 설명 표시용
   */
  const selectedBait = baitOptions.find((item) => item.value === baitType);
  const selectedGroundbait = groundbaitOptions.find(
    (item) => item.value === groundbaitType,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">낚시 예상 수익 계산기</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* =========================
            왼쪽: 입력 영역
            ========================= */}
        <section className="space-y-6 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">입력값</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="행운"
              value={luck}
              step={0.1}
              onChange={(value) => {
                setLuck(value);
                setIsDirty(true);
              }}
            />
            <NumberField
              label="감각"
              value={sense}
              step={0.1}
              onChange={(value) => {
                setSense(value);
                setIsDirty(true);
              }}
            />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">낚시 스킬</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="소문난 미끼 레벨"
                value={rumoredBait}
                min={0}
                max={30}
                onChange={(value) => {
                  setRumoredBait(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="낚싯줄 장력 레벨"
                value={lineTension}
                min={0}
                max={30}
                onChange={(value) => {
                  setLineTension(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="쌍걸이 레벨"
                value={doubleHook}
                min={0}
                max={30}
                onChange={(value) => {
                  setDoubleHook(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="떼낚시 레벨"
                value={schoolFishing}
                min={0}
                max={30}
                onChange={(value) => {
                  setSchoolFishing(value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">환경</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="시간대"
                value={timeOfDay}
                onChange={(value) => {
                  setTimeOfDay(value as TimeOfDay);
                  setIsDirty(true);
                }}
                options={[
                  { value: "day", label: "낮" },
                  { value: "night", label: "밤" },
                ]}
              />

              <SelectField
                label="어장 상태"
                value={pondState}
                onChange={(value) => {
                  setPondState(value as PondState);
                  setIsDirty(true);
                }}
                options={[
                  { value: "abundant", label: "풍부" },
                  { value: "normal", label: "보통" },
                  { value: "depleted", label: "고갈" },
                ]}
              />

              <SelectField
                label="미끼 종류"
                value={baitType}
                onChange={(value) => {
                  setBaitType(value as BaitType);
                  setIsDirty(true);
                }}
                options={baitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <SelectField
                label="떡밥 종류"
                value={groundbaitType}
                onChange={(value) => {
                  setGroundbaitType(value as GroundbaitType);
                  setIsDirty(true);
                }}
                options={groundbaitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <NumberField
                label="미끼 인챈트 레벨 (Lure)"
                value={lureEnchantLevel}
                min={0}
                max={3}
                onChange={(value) => {
                  setLureEnchantLevel(value);
                  setIsDirty(true);
                }}
              />

              <SelectField
                label="갈증 최소치"
                value={String(thirstMin)}
                onChange={(value) => {
                  setThirstMin(Number(value) as ThirstMin);
                  setIsDirty(true);
                }}
                options={[
                  { value: "15", label: "15 이상 유지" },
                  { value: "10", label: "10 이상 유지" },
                  { value: "5", label: "5 이상 유지" },
                  { value: "1", label: "1 이상 유지" },
                ]}
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
                onChange={(value) => {
                  setUseDoubleHook(value);
                  setIsDirty(true);
                }}
              />

              <CheckboxField
                label="떼낚시 사용"
                checked={useSchoolFishing}
                onChange={(value) => {
                  setUseSchoolFishing(value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">물고기 시세</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="일반 가격"
                value={normalPrice}
                min={0}
                onChange={(value) => {
                  setNormalPrice(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="고급 가격"
                value={advancedPrice}
                min={0}
                onChange={(value) => {
                  setAdvancedPrice(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="희귀 가격"
                value={rarePrice}
                min={0}
                onChange={(value) => {
                  setRarePrice(value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* 입력값 변경 후 계산 버튼을 눌러야 반영된다는 안내 */}
          <div className="rounded-xl border border-dashed p-4 text-sm text-neutral-400">
            입력값을 수정한 뒤 <span className="font-semibold">계산하기</span> 버튼을 누르면
            결과가 갱신됩니다.
            {isDirty && (
              <p className="mt-2 font-medium text-amber-400">
                현재 입력값이 변경되었습니다. 아직 계산 결과에 반영되지 않았습니다.
              </p>
            )}
          </div>

          {/* 계산/초기화 버튼 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCalculate}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              계산하기
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-neutral-900"
            >
              초기값으로 되돌리기
            </button>
          </div>
        </section>

        {/* =========================
            오른쪽: 결과 영역
            ========================= */}
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
                "실제 기척 시간(인챈트 적용)",
                `${result.catchTime.finalNibbleSeconds.toFixed(2)}초 (${result.catchTime.finalNibbleTicks.toFixed(2)}틱)`,
              ],
              [
                "표시 입질 시간(인챈트 미적용)",
                `${result.catchTime.displayBiteSeconds.toFixed(2)}초 (${result.catchTime.displayBiteTicks.toFixed(2)}틱)`,
              ],
              ["총 1회 시간", `${result.catchTime.totalCycleSeconds.toFixed(2)}초`],
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
                "더블 캐치 확률",
                `${result.catchExpectation.doubleCatchChancePercent.toFixed(2)}%`,
              ],
              [
                "2회 낚시 확률",
                `${result.catchExpectation.doubleCastChancePercent.toFixed(2)}%`,
              ],
              [
                "낚시 1회당 기대 물고기 수",
                `${result.catchExpectation.fishPerCatch.toFixed(3)}개`,
              ],
              [
                "1회 사이클당 기대 낚시 횟수",
                `${result.catchExpectation.catchCountPerCycle.toFixed(3)}회`,
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
 * - 공통 스타일 재사용
 * - min/max/step은 선택값
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
 * select 공통 컴포넌트
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
 * checkbox 공통 컴포넌트
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
 * 결과 카드 공통 컴포넌트
 * rows는 [왼쪽 제목, 오른쪽 값] 배열
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
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}