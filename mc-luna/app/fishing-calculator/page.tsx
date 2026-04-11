"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { calculateFishing } from "@/src/lib/fishing/calc";
import type {
  BaitType,
  FishingCalculationInput,
  GroundbaitType,
  PondState,
  ThirstMin,
  TimeOfDay,
} from "@/src/lib/fishing/types";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";
import {
  formatCell,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatPercentFromRatio,
} from "@/src/lib/format";
import StatNumberInput from "@/src/components/calculator/StatNumberInput";
// 물고기 설정을 위한 Import
import { toast } from "sonner";
import { useAuth } from "@/src/hooks/useAuth";
import FishSelectionModal from "@/src/components/fishing/FishSelectionModal";
import {
  APP_MIN_FISH_SELECTION,
  BIOME_FISH_KEY_MAP,
  FISHING_BIOME_OPTIONS,
  canUseFishSelectionForBiome,
  createInitialFishSelectionByBiome,
  getDefaultFishKeysForBiome,
  type FishingBiomeKey,
} from "@/src/lib/fishing/fishBiome";
import {
  FISHING_MARKET_ITEMS,
} from "@/src/lib/market/defaultPrices";
import {
  loadUserMarketPrices,
  upsertUserMarketPrices,
} from "@/src/lib/market/db";
import type {
  MarketGrade,
  UserMarketPriceRow,
} from "@/src/lib/market/types";
import { mergeUserPrices } from "@/src/lib/market/merge";

const baitOptions: {
  value: BaitType;
  label: string;
  descriptionLines: string[];
}[] = [
  {
    value: "none",
    label: "없음",
    descriptionLines: ["미끼 미사용"],
  },
  {
    value: "worm",
    label: "지렁이 미끼",
    descriptionLines: [
      "기척 -5%, 입질 -3%",
      "고급 +20, 희귀 +10",
      "2회낚시 +3%",
    ],
  },
  {
    value: "meal",
    label: "어분 미끼",
    descriptionLines: [
      "기척 -10%, 입질 -5%",
      "고급 +30, 희귀 +15",
      "2회낚시 +5%",
    ],
  },
  {
    value: "lure",
    label: "루어 미끼",
    descriptionLines: [
      "기척 -15%, 입질 -10%",
      "고급 +40, 희귀 +30",
      "2회낚시 +8%",
    ],
  },
];

const groundbaitOptions: {
  value: GroundbaitType;
  label: string;
  descriptionLines: string[];
}[] = [
  {
    value: "none",
    label: "없음",
    descriptionLines: ["떡밥 미사용"],
  },
  {
    value: "plain",
    label: "평범한 떡밥",
    descriptionLines: ["기척 -2%", "소모 -15%"],
  },
  {
    value: "good",
    label: "잘만든 떡밥",
    descriptionLines: ["기척 -2%, 입질 -3%", "소모 -30%, 보통 유지"],
  },
  {
    value: "rainbow",
    label: "무지개 떡밥",
    descriptionLines: ["기척 -5%, 입질 -5%", "소모 -50%, 풍부 취급"],
  },
];

const timeOptions: { value: TimeOfDay; label: string }[] = [
  { value: "day", label: "낮" },
  { value: "night", label: "밤" },
];

const pondOptions: { value: PondState; label: string }[] = [
  { value: "abundant", label: "풍부" },
  { value: "normal", label: "보통" },
  { value: "depleted", label: "고갈" },
];

const thirstOptions: { value: ThirstMin; label: string }[] = [
  { value: 15, label: "15 이상 유지" },
  { value: 10, label: "10 이상 유지" },
  { value: 5, label: "5 이상 유지" },
  { value: 1, label: "1 이상 유지" },
];

// 물고기 설정을 위한 함수
function buildFishPriceEditKey(itemKey: string, grade: MarketGrade) {
  return `${itemKey}:${grade}`;
}

function createInitialFishPriceMap() {
  const next: Record<string, number> = {};

  FISHING_MARKET_ITEMS.forEach((item) => {
    next[buildFishPriceEditKey(item.key, "normal")] = Number(item.prices.normal ?? 0);
    next[buildFishPriceEditKey(item.key, "advanced")] = Number(item.prices.advanced ?? 0);
    next[buildFishPriceEditKey(item.key, "rare")] = Number(item.prices.rare ?? 0);
  });

  return next;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeFishingBiome(value: unknown): FishingBiomeKey {
  const fallback: FishingBiomeKey = "ocean";

  if (typeof value !== "string") return fallback;

  const matched = FISHING_BIOME_OPTIONS.find((item) => item.value === value);
  return matched?.value ?? fallback;
}

function normalizeSelectedFishByBiome(
  raw: unknown,
): Record<FishingBiomeKey, string[]> {
  const fallback = createInitialFishSelectionByBiome();

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const source = raw as Record<string, unknown>;
  const next = { ...fallback };

  FISHING_BIOME_OPTIONS.forEach(({ value }) => {
    const allowedFishKeys = new Set(BIOME_FISH_KEY_MAP[value] ?? []);
    const rawFishKeys = Array.isArray(source[value]) ? source[value] : [];

    const filtered = Array.from(
      new Set(
        rawFishKeys.filter(
          (item): item is string =>
            typeof item === "string" && allowedFishKeys.has(item),
        ),
      ),
    );

    /**
     * 앱 정책상 선택 가능한 바이옴은 최소 5마리 이상이어야 한다.
     * 저장값이 깨졌거나 조건 미달이면 기본값으로 복구한다.
     * 선택 불가 바이옴(기본 물고기 수 < 5)은 기본값 그대로 둔다.
     */
    if (canUseFishSelectionForBiome(value)) {
      next[value] =
        filtered.length >= APP_MIN_FISH_SELECTION
          ? filtered
          : fallback[value];
    } else {
      next[value] = fallback[value];
    }
  });

  return next;
}

const INITIAL_FORM = {
  luck: 0,
  sense: 0,
  

  /**
   * 도감 효과
   * - 프로필 값 자동 반영
   * - 수동 수정 불가
   */
  normalFishReduction: 0,
  nibbleTimeReduction: 0,

  rumoredBait: 0,
  lineTension: 0,
  doubleHook: 0,
  schoolFishing: 0,
  timeOfDay: "day" as TimeOfDay,
  pondState: "abundant" as PondState,
  baitType: "none" as BaitType,
  groundbaitType: "none" as GroundbaitType,
  lureEnchantLevel: 3,
  thirstMin: 15 as ThirstMin,
  useDoubleHook: false,
  useSchoolFishing: false,
  normalPrice: 10,
  advancedPrice: 20,
  rarePrice: 50,
};

function createInitialCalculationInput(): FishingCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
      normalFishReduction: INITIAL_FORM.normalFishReduction,
      nibbleTimeReduction: INITIAL_FORM.nibbleTimeReduction,
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

export default function FishingCalculatorPage() {
  /**
   * 페이지 진입 전 공통 가드
   *
   * 정책:
   * - 로그인 안 되어 있으면 /login
   * - 마인크래프트 프로필 연동이 안 되어 있으면 /profile
   *
   * 주의:
   * - 아래의 기존 loadProfileToCalculator()는
   *   "계산기 입력값 자동 불러오기" 역할이고,
   * - 이 가드는
   *   "이 페이지에 들어올 자격이 있는지"만 먼저 검사한다.
   *
   * 즉, 역할이 다르므로 둘 다 유지한다.
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "낚시 계산기를 사용하려면 로그인이 필요합니다.",
    profileMessage: "낚시 계산기를 사용하려면 프로필 연동이 필요합니다.",
  });

  const loadingProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  /**
   * 도감 효과
   * - 일반 물고기 감소비율
   * - 기척 시간 감소
   * 프로필에서 자동 불러오기만 하고 수정은 막는다.
   */
  const [normalFishReduction, setNormalFishReduction] = useState(
    INITIAL_FORM.normalFishReduction,
  );
  const [nibbleTimeReduction, setNibbleTimeReduction] = useState(
    INITIAL_FORM.nibbleTimeReduction,
  );

  const [rumoredBait, setRumoredBait] = useState(INITIAL_FORM.rumoredBait);
  const [lineTension, setLineTension] = useState(INITIAL_FORM.lineTension);
  const [doubleHook, setDoubleHook] = useState(INITIAL_FORM.doubleHook);
  const [schoolFishing, setSchoolFishing] = useState(INITIAL_FORM.schoolFishing);

  const [timeOfDay, setTimeOfDay] = useState(INITIAL_FORM.timeOfDay);
  const [pondState, setPondState] = useState(INITIAL_FORM.pondState);
  const [baitType, setBaitType] = useState(INITIAL_FORM.baitType);
  const [groundbaitType, setGroundbaitType] = useState(
    INITIAL_FORM.groundbaitType,
  );
  const [lureEnchantLevel, setLureEnchantLevel] = useState(
    INITIAL_FORM.lureEnchantLevel,
  );
  const [thirstMin, setThirstMin] = useState(INITIAL_FORM.thirstMin);
  const [useDoubleHook, setUseDoubleHook] = useState(INITIAL_FORM.useDoubleHook);
  const [useSchoolFishing, setUseSchoolFishing] = useState(
    INITIAL_FORM.useSchoolFishing,
  );

  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  const { user, loading: authLoading } = useAuth();

  const [selectedBiome, setSelectedBiome] = useState<FishingBiomeKey>("ocean");

  /**
   * 바이옴별 선택 물고기 목록을 따로 저장한다.
   * 그래야 대양에서 설정한 뒤 강으로 바꿨다가 다시 대양으로 돌아와도
   * 이전 설정이 유지된다.
   */
  const [selectedFishByBiome, setSelectedFishByBiome] = useState<
    Record<FishingBiomeKey, string[]>
  >(() => createInitialFishSelectionByBiome());

  const [fishModalOpen, setFishModalOpen] = useState(false);
  const [editingFishKeys, setEditingFishKeys] = useState<string[]>(
    getDefaultFishKeysForBiome("ocean"),
  );

  const [fishPrices, setFishPrices] = useState<Record<string, number>>(
    createInitialFishPriceMap(),
  );

  const [priceLoading, setPriceLoading] = useState(false);
  const [savingFishPrices, setSavingFishPrices] = useState(false);
  const [savingFishSelections, setSavingFishSelections] = useState(false);

  const [result, setResult] = useState(() =>                      
    calculateFishing(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const [expPerFish, setExpPerFish] = useState(72);
  const [remainingExp, setRemainingExp] = useState(0);
  const [expResult, setExpResult] = useState<{
    catchesPerHour: number;
    expPerHour: number;
    levelUpHours: number;
  } | null>(null);
  const [isExpDirty, setIsExpDirty] = useState(false);

  const loadProfileToCalculator = useCallback(async () => {
    if (loadingProfileRef.current) return;
    if (profileLoaded) return;
    loadingProfileRef.current = true;

    try {
      let user = null;

      for (let i = 0; i < 5; i++) {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn("getSession 실패:", error.message);
        }

        if (session?.user) {
          user = session.user;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!user) {
        setPlanType(null);
        setProfileLoaded(false);
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("plan_type")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.warn("profiles 조회 실패:", profileError.message);
        return;
      }

      const nextPlanType = (profileRow?.plan_type ?? "free") as "free" | "pro";

      const { data: fishingProfile, error: fishingProfileError } = await supabase
        .from("fishing_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fishingProfileError || !fishingProfile) {
        console.warn("fishing_profiles 조회 실패:", fishingProfileError?.message);
        setPlanType(nextPlanType);
        setProfileLoaded(false);
        return;
      }

      const { data: skillLevels, error: skillLevelsError } = await supabase
        .from("user_skill_levels")
        .select("skill_id, skill_level")
        .eq("user_id", user.id);

      if (skillLevelsError) {
        console.warn("user_skill_levels 조회 실패:", skillLevelsError.message);
        return;
      }

      const { data: skillDefinitions, error: skillDefinitionsError } =
        await supabase
          .from("skill_definitions")
          .select("id, skill_name_ko")
          .eq("job_code", "fishing")
          .eq("is_enabled", true);

      if (skillDefinitionsError) {
        console.warn("skill_definitions 조회 실패:", skillDefinitionsError.message);
        return;
      }

      const skillMap = Object.fromEntries(
        (skillLevels ?? []).map((row) => {
          const matched = (skillDefinitions ?? []).find(
            (def) => def.id === row.skill_id,
          );
          return [matched?.skill_name_ko ?? "", row.skill_level];
        }),
      );

      const nextLuck = Number(fishingProfile.luck_total ?? INITIAL_FORM.luck);
      const nextSense = Number(fishingProfile.sense_total ?? INITIAL_FORM.sense);
      const nextNormalFishReduction = Number(
        fishingProfile.normal_fish_reduction_total ?? INITIAL_FORM.normalFishReduction,
      );
      const nextNibbleTimeReduction = Number(
        fishingProfile.nibble_time_reduction_total ?? INITIAL_FORM.nibbleTimeReduction,
      );

      const nextRumoredBait = Number(
        skillMap["소문난 미끼"] ?? INITIAL_FORM.rumoredBait,
      );
      const nextLineTension = Number(
        skillMap["낚싯줄 장력"] ?? INITIAL_FORM.lineTension,
      );
      const nextDoubleHook = Number(
        skillMap["쌍걸이"] ?? INITIAL_FORM.doubleHook,
      );
      const nextSchoolFishing = Number(
        skillMap["떼낚시"] ?? INITIAL_FORM.schoolFishing,
      );

      setLuck(nextLuck);
      setSense(nextSense);
      setNormalFishReduction(nextNormalFishReduction);
      setNibbleTimeReduction(nextNibbleTimeReduction);
      setRumoredBait(nextRumoredBait);
      setLineTension(nextLineTension);
      setDoubleHook(nextDoubleHook);
      setSchoolFishing(nextSchoolFishing);

      setPlanType(nextPlanType);
      setProfileLoaded(true);

      /**
       * 초기 진입/재진입 시에만 결과도 최신 프로필 기준으로 맞춰 둔다.
       * 사용자가 이후 계산기에서 수정한 값은 강제로 다시 덮어쓰지 않는다.
       */
      const nextResult = calculateFishing({
        stats: {
          luck: nextLuck,
          sense: nextSense,
          normalFishReduction: nextNormalFishReduction,
          nibbleTimeReduction: nextNibbleTimeReduction,
        },
        skills: {
          rumoredBait: nextRumoredBait,
          lineTension: nextLineTension,
          doubleHook: nextDoubleHook,
          schoolFishing: nextSchoolFishing,
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
      });

      setResult(nextResult);
      setIsDirty(false);
    } finally {
      loadingProfileRef.current = false;
    }
  }, [
    timeOfDay,
    pondState,
    baitType,
    groundbaitType,
    lureEnchantLevel,
    thirstMin,
    useDoubleHook,
    useSchoolFishing,
    normalPrice,
    advancedPrice,
    rarePrice,
  ]);

  useEffect(() => {
    if (guardLoading) return;
    if (!allowed) return;

    loadProfileToCalculator();
  }, [guardLoading, allowed, loadProfileToCalculator]);

  const isProUser = planType === "pro";
  const disableProfileFields = planType !== "pro";
  const disableDoubleHookCheckbox = doubleHook <= 0;
  const disableSchoolFishingCheckbox = schoolFishing <= 0;

  useEffect(() => {
    if (doubleHook <= 0 && useDoubleHook) {
      setUseDoubleHook(false);
      setIsDirty(true);
    }
  }, [doubleHook, useDoubleHook]);

  useEffect(() => {
    if (schoolFishing <= 0 && useSchoolFishing) {
      setUseSchoolFishing(false);
      setIsDirty(true);
    }
  }, [schoolFishing, useSchoolFishing]);

  // 물고기 설정을 위한 변수값
  const currentBiomeFishKeys = useMemo(
    () => BIOME_FISH_KEY_MAP[selectedBiome] ?? [],
    [selectedBiome],
  );

  const appliedFishKeys = useMemo(
    () => selectedFishByBiome[selectedBiome] ?? [],
    [selectedBiome, selectedFishByBiome],
  );

  const canOpenFishSelection = useMemo(
    () => canUseFishSelectionForBiome(selectedBiome),
    [selectedBiome],
  );

  const selectedFishItems = useMemo(() => {
    return FISHING_MARKET_ITEMS.filter((item) => appliedFishKeys.includes(item.key));
  }, [appliedFishKeys]);

  const calculatedNormalAverage = useMemo(() => {
    const values = appliedFishKeys.map(
      (fishKey) => fishPrices[buildFishPriceEditKey(fishKey, "normal")] ?? 0,
    );
    return average(values);
  }, [appliedFishKeys, fishPrices]);

  const calculatedAdvancedAverage = useMemo(() => {
    const values = appliedFishKeys.map(
      (fishKey) => fishPrices[buildFishPriceEditKey(fishKey, "advanced")] ?? 0,
    );
    return average(values);
  }, [appliedFishKeys, fishPrices]);

  const calculatedRareAverage = useMemo(() => {
    const values = appliedFishKeys.map(
      (fishKey) => fishPrices[buildFishPriceEditKey(fishKey, "rare")] ?? 0,
    );
    return average(values);
  }, [appliedFishKeys, fishPrices]);

  useEffect(() => {
    setEditingFishKeys(selectedFishByBiome[selectedBiome] ?? getDefaultFishKeysForBiome(selectedBiome));
  }, [selectedBiome, selectedFishByBiome]);

  /**
   * 선택된 물고기들의 평균 시세를 기존 평균 시세 입력칸에 자동 반영한다.
   * 사용자가 필요하면 직접 다시 수정할 수 있다.
   * 단, 물고기 선택/개별 시세가 바뀌면 다시 평균값으로 재계산된다.
   */
  useEffect(() => {
    setNormalPrice(Number(calculatedNormalAverage.toFixed(2)));
    setAdvancedPrice(Number(calculatedAdvancedAverage.toFixed(2)));
    setRarePrice(Number(calculatedRareAverage.toFixed(2)));
    setIsDirty(true);
  }, [calculatedNormalAverage, calculatedAdvancedAverage, calculatedRareAverage]);

  // 낚시 시세 로딩 callback 함수
  const loadFishingPrices = useCallback(async () => {
    if (guardLoading) return;
    if (!allowed) return;
    if (authLoading) return;
    if (!user) return;

    try {
      setPriceLoading(true);

      const userRows = await loadUserMarketPrices(user.id, "fishing");
      const mergedItems = mergeUserPrices(FISHING_MARKET_ITEMS, userRows);

      const nextMap: Record<string, number> = {};
      mergedItems.forEach((item) => {
        nextMap[buildFishPriceEditKey(item.key, "normal")] = Number(item.prices.normal ?? 0);
        nextMap[buildFishPriceEditKey(item.key, "advanced")] = Number(item.prices.advanced ?? 0);
        nextMap[buildFishPriceEditKey(item.key, "rare")] = Number(item.prices.rare ?? 0);
      });

      setFishPrices(nextMap);
    } catch (error) {
      console.error("fishing 시세 로딩 중 예외:", error);
      toast.error("물고기 시세를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setPriceLoading(false);
    }
  }, [allowed, authLoading, guardLoading, user]);

  useEffect(() => {
    void loadFishingPrices();
  }, [loadFishingPrices]);

  const loadFishingSelections = useCallback(async () => {
    if (guardLoading) return;
    if (!allowed) return;
    if (authLoading) return;
    if (!user) return;
    if (!isProUser) return;

    try {
      const { data, error } = await supabase
        .from("user_fishing_settings")
        .select("selected_fish_by_biome, last_selected_biome")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("fishing 설정 로딩 중 예외:", error);
        toast.error("물고기 설정을 불러오는 중 오류가 발생했습니다.");
        return;
      }

      if (!data) return;

      const normalizedSelections = normalizeSelectedFishByBiome(
        data.selected_fish_by_biome,
      );
      const normalizedBiome = normalizeFishingBiome(data.last_selected_biome);

      setSelectedFishByBiome(normalizedSelections);
      setSelectedBiome(normalizedBiome);
    } catch (error) {
      console.error("fishing 설정 로딩 중 예외:", error);
      toast.error("물고기 설정을 불러오는 중 오류가 발생했습니다.");
    }
  }, [allowed, authLoading, guardLoading, user, isProUser]);

  useEffect(() => {
    void loadFishingSelections();
  }, [loadFishingSelections]);

  // 물고기 시세 저장 함수
  const handleSaveFishPrices = async () => {
    if (!user) {
      toast.error("사용자 정보를 확인할 수 없습니다.");
      return;
    }

    if (!isProUser) {
      toast.error("물고기 시세 저장은 Pro 사용자만 가능합니다.");
      return;
    }

    try {
      setSavingFishPrices(true);

      const rows: UserMarketPriceRow[] = [];

      FISHING_MARKET_ITEMS.forEach((item) => {
        rows.push({
          user_id: user.id,
          category: "fishing",
          item_key: item.key,
          grade: "normal",
          price: fishPrices[buildFishPriceEditKey(item.key, "normal")] ?? 0,
        });
        rows.push({
          user_id: user.id,
          category: "fishing",
          item_key: item.key,
          grade: "advanced",
          price: fishPrices[buildFishPriceEditKey(item.key, "advanced")] ?? 0,
        });
        rows.push({
          user_id: user.id,
          category: "fishing",
          item_key: item.key,
          grade: "rare",
          price: fishPrices[buildFishPriceEditKey(item.key, "rare")] ?? 0,
        });
      });

      await upsertUserMarketPrices(rows);
      toast.success("물고기 시세가 저장되었습니다.");
      await loadFishingPrices();
    } catch (error) {
      console.error("fishing 시세 저장 중 예외:", error);
      toast.error("물고기 시세 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingFishPrices(false);
    }
  };

  const handleSaveFishSelections = async () => {
  if (!user) {
    toast.error("사용자 정보를 확인할 수 없습니다.");
    return;
  }

  if (!isProUser) {
    toast.error("물고기 설정 저장은 Pro 사용자만 가능합니다.");
    return;
  }

  /**
   * 현재 모달에서 편집 중인 선택값도 저장 대상에 포함한다.
   * 즉, 적용 버튼을 누르지 않았더라도 저장 버튼만 눌러 저장 가능하게 한다.
   */
  const nextSelectedFishByBiome = {
      ...selectedFishByBiome,
    };

    if (canOpenFishSelection) {
      if (editingFishKeys.length < APP_MIN_FISH_SELECTION) {
        toast.error(`최소 ${APP_MIN_FISH_SELECTION}마리 이상 선택해야 합니다.`);
        return;
      }

      nextSelectedFishByBiome[selectedBiome] = [...editingFishKeys];
    }

    try {
      setSavingFishSelections(true);

      const payload = {
        user_id: user.id,
        selected_fish_by_biome: nextSelectedFishByBiome,
        last_selected_biome: selectedBiome,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("user_fishing_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.error("fishing 설정 저장 중 예외:", error);
        toast.error("물고기 설정 저장 중 오류가 발생했습니다.");
        return;
      }

      /**
       * 저장 성공 시 화면 상태도 즉시 동기화한다.
       */
      setSelectedFishByBiome(nextSelectedFishByBiome);
      setEditingFishKeys([...nextSelectedFishByBiome[selectedBiome]]);
      toast.success("물고기 설정이 저장되었습니다.");
    } catch (error) {
      console.error("fishing 설정 저장 중 예외:", error);
      toast.error("물고기 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingFishSelections(false);
    }
  };

  // 모달 열기,적용,토글 함수
  const handleOpenFishModal = () => {
    if (!canOpenFishSelection) {
      toast.error(
        `이 바이옴은 앱 정책상 최소 ${APP_MIN_FISH_SELECTION}마리 이상이 필요해 물고기 설정을 사용할 수 없습니다.`,
      );
      return;
    }

    setEditingFishKeys([...appliedFishKeys]);
    setFishModalOpen(true);
  };

  const handleResetEditingFish = () => {
    setEditingFishKeys(getDefaultFishKeysForBiome(selectedBiome));
  };

  const handleFishPriceChange = (
    fishKey: string,
    grade: "normal" | "advanced" | "rare",
    value: number,
  ) => {
    setFishPrices((prev) => ({
      ...prev,
      [buildFishPriceEditKey(fishKey, grade)]: value,
    }));
  };

  const handleToggleEditingFish = (fishKey: string) => {
    setEditingFishKeys((prev) => {
      if (prev.includes(fishKey)) {
        return prev.filter((key) => key !== fishKey);
      }

      return [...prev, fishKey];
    });
  };

  const handleApplyFishSelection = () => {
    if (editingFishKeys.length < APP_MIN_FISH_SELECTION) {
      toast.error(`최소 ${APP_MIN_FISH_SELECTION}마리 이상 선택해야 합니다.`);
      return;
    }

    setSelectedFishByBiome((prev) => ({
      ...prev,
      [selectedBiome]: [...editingFishKeys],
    }));
    setFishModalOpen(false);
    setIsDirty(true);
  };

  const buildCalculationInput = (): FishingCalculationInput => {
    return {
      stats: {
        luck,
        sense,
        normalFishReduction,
        nibbleTimeReduction,
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

  const handleCalculate = useCallback(() => {
    const nextResult = calculateFishing(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  }, [
    luck,
    sense,
    normalFishReduction,
    nibbleTimeReduction,
    rumoredBait,
    lineTension,
    doubleHook,
    schoolFishing,
    timeOfDay,
    pondState,
    baitType,
    groundbaitType,
    lureEnchantLevel,
    thirstMin,
    useDoubleHook,
    useSchoolFishing,
    normalPrice,
    advancedPrice,
    rarePrice,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);
    setNormalFishReduction(INITIAL_FORM.normalFishReduction);
    setNibbleTimeReduction(INITIAL_FORM.nibbleTimeReduction);

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

    setSelectedBiome("ocean");
    setSelectedFishByBiome(createInitialFishSelectionByBiome());
    setEditingFishKeys(getDefaultFishKeysForBiome("ocean"));
    setFishPrices(createInitialFishPriceMap());
    setSavingFishSelections(false);

    setResult(calculateFishing(createInitialCalculationInput()));
    setIsDirty(false);

    setExpPerFish(72);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  const selectedBait = useMemo(
    () => baitOptions.find((item) => item.value === baitType),
    [baitType],
  );

  const selectedGroundbait = useMemo(
    () => groundbaitOptions.find((item) => item.value === groundbaitType),
    [groundbaitType],
  );

  /**
   * =========================
   * 오른쪽 결과 패널 표시용 파생값
   * =========================
   *
   * 요구사항 기준:
   * - "실제 기척 시간(인챈트 적용)" 아래에 도감-기척 시간 감소 표시
   * - "최종 기척 시간" = 실제 기척 시간 - 도감 효과
   * - 시간당 값들도 이 최종 표시 시간을 기준으로 일관되게 다시 계산
   */
  const displayedFinalNibbleSeconds = Math.max(
    result.catchTime.finalNibbleSeconds - nibbleTimeReduction,
    0,
  );
  const displayedFinalNibbleTicks = displayedFinalNibbleSeconds * 20;

  const displayedTotalCycleSeconds =
    result.catchTime.castStartSeconds +
    displayedFinalNibbleSeconds +
    result.catchTime.displayBiteSeconds +
    result.catchTime.reelInSeconds;

  const cyclesPerHour =
    displayedTotalCycleSeconds > 0 ? 3600 / displayedTotalCycleSeconds : 0;

  const customFishPerHour =
    cyclesPerHour * result.catchExpectation.finalCustomFishPerCycle;

  const expectedValuePerHour =
    cyclesPerHour * result.value.expectedValuePerCycle;

  const formatLevelUpTime = (hours: number) => {
    if (!Number.isFinite(hours) || hours < 0) return "계산 불가";

    const totalMinutes = Math.ceil(hours * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh}시간 ${mm}분`;
  };

  const handleCalculateExp = () => {
    const nextCyclesPerHour =
      displayedTotalCycleSeconds > 0 ? 3600 / displayedTotalCycleSeconds : 0;

    const expFishPerHour =
      nextCyclesPerHour * result.catchExpectation.expCatchCountPerCycle;

    const nextExpPerHour = expFishPerHour * expPerFish;

    const levelUpHours =
      nextExpPerHour > 0
        ? remainingExp / nextExpPerHour
        : Number.POSITIVE_INFINITY;

    setExpResult({
      catchesPerHour: nextCyclesPerHour,
      expPerHour: nextExpPerHour,
      levelUpHours,
    });
    setIsExpDirty(false);
  };

  const handleResetExp = () => {
    setExpPerFish(72);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  /**
   * 공통 가드 확인 중이거나 아직 접근이 허용되지 않은 경우
   *
   * - guardLoading: 로그인/프로필 연동 여부 검사 중
   * - !allowed: 곧 리다이렉트될 예정이므로 본문 렌더링 방지
   */
  if (guardLoading || !allowed) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          낚시 계산기
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }
  return (
    <CalculatorLayout
      title="낚시 계산기"
      left={
        <div className="space-y-6">
          <CalculatorPanel title="입력값">
            <div className="space-y-6">
              {profileLoaded && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <p className="font-semibold">프로필 데이터를 불러왔습니다.</p>
                  <p className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</p>
                  <p className="mt-1">
                    {isProUser
                      ? "→ 프로필 기반 낚시 스탯/스킬 값을 수정할 수 있습니다."
                      : "→ 프로필에서 불러온 낚시 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 스탯</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="행운">
                    <StatNumberInput
                      value={luck}
                      step="0.01"
                      min={0}
                      max={999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setLuck(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="감각">
                    <StatNumberInput
                      value={sense}
                      step="0.01"
                      min={0}
                      max={999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setSense(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">도감 효과</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="일반 물고기 감소비율">
                    <StatNumberInput
                      step="0.01"
                      min={0}
                      max={999}
                      value={normalFishReduction}
                      onChange={(value) => {
                        setNormalFishReduction(value);
                        setIsDirty(true);
                      }}
                      disabled={disableProfileFields}
                    />
                  </Field>

                  <Field label="기척 시간 감소">
                    <StatNumberInput
                      step="0.01"
                      value={nibbleTimeReduction}
                      min={0}
                      max={999}
                      onChange={(value) => {
                        setNibbleTimeReduction(value);
                        setIsDirty(true);
                      }}
                      disabled={disableProfileFields}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 스킬</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="소문난 미끼">
                    <NumberInput
                      value={rumoredBait}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setRumoredBait(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="낚싯줄 장력">
                    <NumberInput
                      value={lineTension}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setLineTension(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="쌍걸이">
                    <NumberInput
                      value={doubleHook}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setDoubleHook(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="떼낚시">
                    <NumberInput
                      value={schoolFishing}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setSchoolFishing(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 환경</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="시간대">
                    <SelectInput
                      value={timeOfDay}
                      options={timeOptions}
                      onChange={(value) => {
                        setTimeOfDay(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="어장 상태">
                    <SelectInput
                      value={pondState}
                      options={pondOptions}
                      onChange={(value) => {
                        setPondState(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="미끼">
                    <SelectInput
                      value={baitType}
                      options={baitOptions.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) => {
                        setBaitType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="떡밥">
                    <SelectInput
                      value={groundbaitType}
                      options={groundbaitOptions.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) => {
                        setGroundbaitType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="미끼 인챈트">
                    <NumberInput
                      value={lureEnchantLevel}
                      min={0}
                      max={3}
                      onChange={(value) => {
                        setLureEnchantLevel(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="갈증 최소치">
                    <SelectInput
                      value={thirstMin.toString()}
                      options={thirstOptions.map(({ value, label }) => ({
                        value: value.toString(),
                        label,
                      }))}
                      onChange={(value) => {
                        setThirstMin(Number(value) as ThirstMin);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="바이옴 선택">
                    <SelectInput
                      value={selectedBiome}
                      options={FISHING_BIOME_OPTIONS.map((item) => ({
                        value: item.value,
                        label: item.label,
                      }))}
                      onChange={(value) => {
                        setSelectedBiome(value as FishingBiomeKey);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="물고기 설정">
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleOpenFishModal}
                        disabled={!canOpenFishSelection}
                        className={[
                          "w-full rounded-xl px-4 py-2 font-medium text-white transition",
                          canOpenFishSelection
                            ? "bg-blue-600 hover:bg-blue-500"
                            : "cursor-not-allowed bg-zinc-400",
                        ].join(" ")}
                      >
                        물고기 설정
                      </button>

                      <p className="text-xs text-zinc-500">
                        현재 바이옴 선택 수: {appliedFishKeys.length}마리
                        {!canOpenFishSelection &&
                          ` / 이 바이옴은 앱 정책상 최소 ${APP_MIN_FISH_SELECTION}마리 조건 미달로 설정 불가`}
                      </p>
                    </div>
                  </Field>

                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      선택 미끼 효과: {selectedBait?.label ?? "없음"}
                    </p>
                    <div className="mt-2 space-y-0.5 leading-6">
                      {(selectedBait?.descriptionLines ?? ["미끼 미사용"]).map(
                        (line) => (
                          <p key={line}>{line}</p>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      선택 떡밥 효과: {selectedGroundbait?.label ?? "없음"}
                    </p>
                    <div className="mt-2 space-y-0.5 leading-6">
                      {(
                        selectedGroundbait?.descriptionLines ?? ["떡밥 미사용"]
                      ).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      ※ 자원 소모/어장 상태 보정 효과는 안내용이며, 시간당 수익 계산에는
                      직접 반영하지 않았습니다.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={useDoubleHook}
                      disabled={disableDoubleHookCheckbox}
                      onChange={(e) => {
                        setUseDoubleHook(e.target.checked);
                        setIsDirty(true);
                      }}
                    />
                    <span>
                      쌍걸이 사용
                      {disableDoubleHookCheckbox && " (레벨 0)"}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={useSchoolFishing}
                      disabled={disableSchoolFishingCheckbox}
                      onChange={(e) => {
                        setUseSchoolFishing(e.target.checked);
                        setIsDirty(true);
                      }}
                    />
                    <span>
                      떼낚시 사용
                      {disableSchoolFishingCheckbox && " (레벨 0)"}
                    </span>
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">평균 시세</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="일반">
                    <NumberInput
                      value={normalPrice}
                      min={0}
                      onChange={(value) => {
                        setNormalPrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="고급">
                    <NumberInput
                      value={advancedPrice}
                      min={0}
                      onChange={(value) => {
                        setAdvancedPrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="희귀">
                    <NumberInput
                      value={rarePrice}
                      min={0}
                      onChange={(value) => {
                        setRarePrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
                <ActionButton onClick={handleReset} variant="secondary">
                  전체 초기화
                </ActionButton>
              </div>

              {isDirty && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
                </div>
              )}
            </div>

            <FishSelectionModal
              open={fishModalOpen}
              biome={selectedBiome}
              fishKeys={currentBiomeFishKeys}
              selectedKeys={editingFishKeys}
              fishPrices={fishPrices}
              buildFishPriceEditKey={buildFishPriceEditKey}
              onToggle={handleToggleEditingFish}
              onResetSelection={handleResetEditingFish}
              onPriceChange={handleFishPriceChange}
              onSavePrices={handleSaveFishPrices}
              onSaveSelections={handleSaveFishSelections}
              isProUser={isProUser}
              savingFishPrices={savingFishPrices}
              savingFishSelections={savingFishSelections}
              onApply={handleApplyFishSelection}
              onClose={() => setFishModalOpen(false)}
              disabled={!canOpenFishSelection}
            />
          </CalculatorPanel>
        </div>
      }
      right={
        <CalculatorPanel title="계산 결과">
          <ResultCard title="낚시 시간">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>낚싯대 던지는 시간</span>
                <span>{formatDecimal(result.catchTime.castStartSeconds, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>표시 기척 시간(인챈트 미적용)</span>
                <span>
                  {formatDecimal(result.catchTime.displayNibbleSeconds, 2)}초 (
                  {formatDecimal(result.catchTime.displayNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>실제 기척 시간(인챈트 적용)</span>
                <span>
                  {formatDecimal(result.catchTime.finalNibbleSeconds, 2)}초 (
                  {formatDecimal(result.catchTime.finalNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>[도감]기척 시간 감소</span>
                <span>{formatDecimal(nibbleTimeReduction, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>최종 기척 시간</span>
                <span>
                  {formatDecimal(displayedFinalNibbleSeconds, 2)}초 (
                  {formatDecimal(displayedFinalNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>표시 입질 시간</span>
                <span>
                  {formatDecimal(result.catchTime.displayBiteSeconds, 2)}초 (
                  {formatDecimal(result.catchTime.displayBiteTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>건져올리는 시간</span>
                <span>{formatDecimal(result.catchTime.reelInSeconds, 2)}초</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>※최종 1회 낚시 시간(던짐+기척+입질+건져올림)</span>
                <span>{formatDecimal(displayedTotalCycleSeconds, 2)}초</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="등급 가중치 / 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>[도감]일반 물고기 감소비율</span>
                <span>{formatPercent(normalFishReduction, 2)}</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>일반 가중치</span>
                <span>{formatDecimal(result.gradeRatio.rawNormal, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 가중치</span>
                <span>{formatDecimal(result.gradeRatio.rawAdvanced, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 가중치</span>
                <span>{formatDecimal(result.gradeRatio.rawRare, 2)}</span>
              </div>
              {/* <div className="flex justify-between">
                <span>전체 가중치 합</span>
                <span>
                  {formatNumber(
                    result.gradeRatio.rawNormal +
                      result.gradeRatio.rawAdvanced +
                      result.gradeRatio.rawRare,
                    2,
                  )}
                </span>
              </div> */}
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>일반 확률</span>
                <span>
                  {formatPercentFromRatio(result.gradeRatio.probabilityNormal, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>고급 확률</span>
                <span>
                  {formatPercentFromRatio(result.gradeRatio.probabilityAdvanced, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>희귀 확률</span>
                <span>{formatPercentFromRatio(result.gradeRatio.probabilityRare, 2)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="결과물 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>바닐라 결과물 확률</span>
                <span>{formatPercent(result.value.vanillaChancePercent, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>커스텀 물고기 확률</span>
                <span>{formatPercent(result.value.customFishChancePercent, 2)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 획득량">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>더블 캐치 확률</span>
                <span>
                  {formatPercent(
                    result.catchExpectation.doubleCatchChancePercent,
                    2,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>낚시 1회당 기대 커스텀 물고기 수</span>
                <span>
                  {formatInteger(
                    result.catchExpectation.finalCustomFishPerCatch,
      
                  )}
                  마리
                </span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>2회 낚시 확률</span>
                <span>
                  {formatPercent(result.catchExpectation.doubleCastChancePercent, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>1사이클당 기대 낚시 횟수</span>
                <span>
                  {formatInteger(result.catchExpectation.catchCountPerCycle)}회
                </span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>최종 기대 획득량(물고기 수 x 낚시 횟수)</span>
                <span>
                  {formatInteger(
                    result.catchExpectation.finalCustomFishPerCycle,
                    
                  )}
                  개
                </span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 수익">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>물고기 1마리 기대가치</span>
                <span>{formatCell(result.value.expectedValuePerFish)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>시간당 커스텀 물고기 수</span>
                <span>{formatInteger(customFishPerHour)}마리</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>낚시 1회당 기대 수익</span>
                <span>{formatCell(result.value.expectedValuePerCycle)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>시간당 낚시 횟수</span>
                <span>{Math.floor(cyclesPerHour).toString()}회</span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    시간당 기대 수익
                  </span>
                <span className="text-lg font-bold text-blue-700">
                  {formatCell(expectedValuePerHour)}셀
                </span>
                </div>
            </div>
          </ResultCard>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">경험치 계산기</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="물고기 1마리당 경험치">
                <NumberInput
                  value={expPerFish}
                  min={0}
                  onChange={(value) => {
                    setExpPerFish(value);
                    setIsExpDirty(true);
                  }}
                />
              </Field>

              <Field label="레벨업까지 남은 경험치">
                <NumberInput
                  value={remainingExp}
                  min={0}
                  onChange={(value) => {
                    setRemainingExp(value);
                    setIsExpDirty(true);
                  }}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton onClick={handleCalculateExp}>경험치 계산</ActionButton>
              <ActionButton variant="secondary" onClick={handleResetExp}>
                경험치 초기화
              </ActionButton>
            </div>

            {isExpDirty && (
              <div className="mt-3 text-sm text-amber-700">
                경험치 입력값이 변경되었습니다.
              </div>
            )}
            <br></br>
            {expResult && (
              <ResultCard title="경험치 결과">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>시간당 획득 경험치</span>
                    <span>{Math.floor(expResult.expPerHour).toString()} exp</span>
                  </div>
                  <div className="flex justify-between">
                    <span>레벨업까지 예상 시간</span>
                    <span>{formatLevelUpTime(expResult.levelUpHours)}</span>
                  </div>
                </div>
              </ResultCard>
            )}
          </div>
        </CalculatorPanel>
      }
    />
  );
}