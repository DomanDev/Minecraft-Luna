"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";

import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";

import { calculateCooking } from "@/src/lib/cooking/calc";
import { COOKING_RECIPES, getCookingRecipe } from "@/src/lib/cooking/recipes";
import type {
  CookingCalculationInput,
  CookingCalculationResult,
  CookingRecipeId,
} from "@/src/lib/cooking/types";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";

const recipeOptions = COOKING_RECIPES.map((recipe) => ({
  value: recipe.id,
  label: `${recipe.name} (${recipe.tierLabel})`,
}));

const INITIAL_FORM = {
  mastery: 0,
  dexterity: 0,

  /**
   * 도감 효과
   * - 프로필에서 자동 불러오며 계산에 반영
   * - UI에서는 read-only
   */
  cookingGradeUpChance: 0,

  /**
   * 현재 프로필 구조에 아직 별도 자동 연동 컬럼이 없을 수 있으므로
   * 일단 계산기 내부 입력값으로 둔다.
   */
  additionalCookTimeReductionPercent: 0,
  additionalFoodDurationBonusPercent: 0,

  preparationMaster: 0,
  balanceOfTaste: 0,
  gourmet: 0,
  instantCompletion: 0,
  banquetPreparation: 0,

  recipeId: "ssambap" as CookingRecipeId,
  normalDishPrice: 100,
  specialDishPrice: 500,

  ingredientUnitPrices: {} as Record<string, number>,
};

function createInitialIngredientPrices(
  recipeId: CookingRecipeId,
): Record<string, number> {
  const recipe = getCookingRecipe(recipeId);
  return recipe.ingredients.reduce<Record<string, number>>((acc, ingredient) => {
    acc[ingredient.id] = 0;
    return acc;
  }, {});
}

function createInitialRareIngredientFlags(
  recipeId: CookingRecipeId,
): Record<string, boolean> {
  const recipe = getCookingRecipe(recipeId);
  return recipe.ingredients.reduce<Record<string, boolean>>((acc, ingredient) => {
    acc[ingredient.id] = false;
    return acc;
  }, {});
}

function createInitialCalculationInput(): CookingCalculationInput {
  return {
    recipeId: INITIAL_FORM.recipeId,
    stats: {
      mastery: INITIAL_FORM.mastery,
      dexterity: INITIAL_FORM.dexterity,
      cookingGradeUpChance: INITIAL_FORM.cookingGradeUpChance,
      additionalCookTimeReductionPercent:
        INITIAL_FORM.additionalCookTimeReductionPercent,
      additionalFoodDurationBonusPercent:
        INITIAL_FORM.additionalFoodDurationBonusPercent,
    },
    skills: {
      preparationMaster: INITIAL_FORM.preparationMaster,
      balanceOfTaste: INITIAL_FORM.balanceOfTaste,
      gourmet: INITIAL_FORM.gourmet,
      instantCompletion: INITIAL_FORM.instantCompletion,
      banquetPreparation: INITIAL_FORM.banquetPreparation,
    },
    prices: {
      normalDishPrice: INITIAL_FORM.normalDishPrice,
      specialDishPrice: INITIAL_FORM.specialDishPrice,
      ingredientUnitPrices: createInitialIngredientPrices(INITIAL_FORM.recipeId),
    },
    rareIngredientFlags: createInitialRareIngredientFlags(INITIAL_FORM.recipeId),
  };
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}%`;
}

function formatSeconds(value: number | null, digits = 1): string {
  if (value == null) return "-";
  return `${formatNumber(value, digits)}초`;
}

function syncIngredientPrices(
  recipeId: CookingRecipeId,
  current: Record<string, number>,
): Record<string, number> {
  const recipe = getCookingRecipe(recipeId);
  const next: Record<string, number> = {};

  recipe.ingredients.forEach((ingredient) => {
    next[ingredient.id] = current[ingredient.id] ?? 0;
  });

  return next;
}

function syncRareIngredientFlags(
  recipeId: CookingRecipeId,
  current: Record<string, boolean>,
): Record<string, boolean> {
  const recipe = getCookingRecipe(recipeId);
  const next: Record<string, boolean> = {};

  recipe.ingredients.forEach((ingredient) => {
    next[ingredient.id] = current[ingredient.id] ?? false;
  });

  return next;
}

export default function CookingCalculatorPage() {
  /**
   * 페이지 진입 전 공통 가드
   *
   * 정책:
   * - 로그인 안 되어 있으면 /login
   * - 마인크래프트 프로필 연동이 안 되어 있으면 /profile
   *
   * 요리 계산기 내부의 loadProfileToCalculator()는
   * "입력값 자동 반영" 역할이고,
   * 이 가드는
   * "페이지 접근 허용 여부"만 먼저 검사한다.
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "요리 계산기를 사용하려면 로그인이 필요합니다.",
    profileMessage: "요리 계산기를 사용하려면 프로필 연동이 필요합니다.",
  });
  const loadingProfileRef = useRef(false);
  const hasLoadedProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [mastery, setMastery] = useState(INITIAL_FORM.mastery);
  const [dexterity, setDexterity] = useState(INITIAL_FORM.dexterity);

  const [cookingGradeUpChance, setCookingGradeUpChance] = useState(
    INITIAL_FORM.cookingGradeUpChance,
  );

  const [additionalCookTimeReductionPercent, setAdditionalCookTimeReductionPercent] =
    useState(INITIAL_FORM.additionalCookTimeReductionPercent);

  const [additionalFoodDurationBonusPercent, setAdditionalFoodDurationBonusPercent] =
    useState(INITIAL_FORM.additionalFoodDurationBonusPercent);

  const [preparationMaster, setPreparationMaster] = useState(
    INITIAL_FORM.preparationMaster,
  );
  const [balanceOfTaste, setBalanceOfTaste] = useState(
    INITIAL_FORM.balanceOfTaste,
  );
  const [gourmet, setGourmet] = useState(INITIAL_FORM.gourmet);
  const [instantCompletion, setInstantCompletion] = useState(
    INITIAL_FORM.instantCompletion,
  );
  const [banquetPreparation, setBanquetPreparation] = useState(
    INITIAL_FORM.banquetPreparation,
  );

  const [recipeId, setRecipeId] = useState<CookingRecipeId>(INITIAL_FORM.recipeId);
  const [ingredientUnitPrices, setIngredientUnitPrices] = useState<Record<string, number>>(
    createInitialIngredientPrices(INITIAL_FORM.recipeId),
  );
  const [rareIngredientFlags, setRareIngredientFlags] = useState<Record<string, boolean>>(
    createInitialRareIngredientFlags(INITIAL_FORM.recipeId),
  );

  const [normalDishPrice, setNormalDishPrice] = useState(INITIAL_FORM.normalDishPrice);
  const [specialDishPrice, setSpecialDishPrice] = useState(INITIAL_FORM.specialDishPrice);

  const [result, setResult] = useState<CookingCalculationResult>(() =>
    calculateCooking(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const selectedRecipe = useMemo(() => getCookingRecipe(recipeId), [recipeId]);

  const isProUser = planType === "pro";
  const disableProfileFields = planType !== "pro";

  const buildCalculationInput = (): CookingCalculationInput => {
    return {
      recipeId,
      stats: {
        mastery,
        dexterity,
        cookingGradeUpChance,
        additionalCookTimeReductionPercent,
        additionalFoodDurationBonusPercent,
      },
      skills: {
        preparationMaster,
        balanceOfTaste,
        gourmet,
        instantCompletion,
        banquetPreparation,
      },
      prices: {
        normalDishPrice,
        specialDishPrice,
        ingredientUnitPrices,
      },
      rareIngredientFlags,
    };
  };

  const loadProfileToCalculator = useCallback(async () => {
    /**
     * 최초 1회만 프로필 로드
     */
    if (loadingProfileRef.current) return;
    if (hasLoadedProfileRef.current) return;

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

        if (i < 4) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      if (!user) {
        setPlanType(null);
        setProfileLoaded(false);
        hasLoadedProfileRef.current = false;
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

      const { data: cookingProfile, error: cookingProfileError } = await supabase
        .from("cooking_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (cookingProfileError || !cookingProfile) {
        console.warn("cooking_profiles 조회 실패:", cookingProfileError?.message);
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

      const { data: skillDefinitions, error: skillDefinitionsError } = await supabase
        .from("skill_definitions")
        .select("id, skill_name_ko")
        .eq("job_code", "cooking")
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

      const nextMastery = Number(cookingProfile.mastery_total ?? INITIAL_FORM.mastery);
      const nextDexterity = Number(
        cookingProfile.dexterity_total ?? INITIAL_FORM.dexterity,
      );
      const nextCookingGradeUpChance = Number(
        cookingProfile.cooking_grade_up_chance_total ??
          INITIAL_FORM.cookingGradeUpChance,
      );

      const nextPreparationMaster = Number(
        skillMap["손질 달인"] ?? INITIAL_FORM.preparationMaster,
      );
      const nextBalanceOfTaste = Number(
        skillMap["맛의 균형"] ?? INITIAL_FORM.balanceOfTaste,
      );
      const nextGourmet = Number(skillMap["미식가"] ?? INITIAL_FORM.gourmet);
      const nextInstantCompletion = Number(
        skillMap["즉시 완성"] ?? INITIAL_FORM.instantCompletion,
      );
      const nextBanquetPreparation = Number(
        skillMap["연회 준비"] ?? INITIAL_FORM.banquetPreparation,
      );

      setMastery(nextMastery);
      setDexterity(nextDexterity);
      setCookingGradeUpChance(nextCookingGradeUpChance);
      setPreparationMaster(nextPreparationMaster);
      setBalanceOfTaste(nextBalanceOfTaste);
      setGourmet(nextGourmet);
      setInstantCompletion(nextInstantCompletion);
      setBanquetPreparation(nextBanquetPreparation);
      setPlanType(nextPlanType);
      setProfileLoaded(true);

      const nextResult = calculateCooking({
        recipeId,
        stats: {
          mastery: nextMastery,
          dexterity: nextDexterity,
          cookingGradeUpChance: nextCookingGradeUpChance,
          additionalCookTimeReductionPercent,
          additionalFoodDurationBonusPercent,
        },
        skills: {
          preparationMaster: nextPreparationMaster,
          balanceOfTaste: nextBalanceOfTaste,
          gourmet: nextGourmet,
          instantCompletion: nextInstantCompletion,
          banquetPreparation: nextBanquetPreparation,
        },
        prices: {
          normalDishPrice,
          specialDishPrice,
          ingredientUnitPrices,
        },
        rareIngredientFlags,
      });

      setResult(nextResult);
      setIsDirty(false);

      /**
       * 최초 1회 로드 완료 표시
       */
      hasLoadedProfileRef.current = true;
    } finally {
      loadingProfileRef.current = false;
    }
  }, [
    recipeId,
    additionalCookTimeReductionPercent,
    additionalFoodDurationBonusPercent,
    normalDishPrice,
    specialDishPrice,
    ingredientUnitPrices,
    rareIngredientFlags,
  ]);

  /**
   * 공통 가드를 통과한 뒤에만
   * 프로필 기반 계산기 자동 입력값을 불러온다.
   */
  useEffect(() => {
    if (guardLoading) return;
    if (!allowed) return;

    loadProfileToCalculator();
  }, [guardLoading, allowed, loadProfileToCalculator]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setPlanType(null);
        setProfileLoaded(false);

        /**
         * 로그아웃 시 다음 로그인에 다시 1회 로드할 수 있도록 리셋
         */
        hasLoadedProfileRef.current = false;
        return;
      }

      if (!hasLoadedProfileRef.current) {
        loadProfileToCalculator();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfileToCalculator]);

  useEffect(() => {
    setIngredientUnitPrices((prev) => syncIngredientPrices(recipeId, prev));
  }, [recipeId]);

  useEffect(() => {
    setRareIngredientFlags((prev) => syncRareIngredientFlags(recipeId, prev));
  }, [recipeId]);

  const handleCalculate = useCallback(() => {
    const nextResult = calculateCooking(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  }, [
    mastery,
    dexterity,
    cookingGradeUpChance,
    additionalCookTimeReductionPercent,
    additionalFoodDurationBonusPercent,
    preparationMaster,
    balanceOfTaste,
    gourmet,
    instantCompletion,
    banquetPreparation,
    recipeId,
    ingredientUnitPrices,
    rareIngredientFlags,
    normalDishPrice,
    specialDishPrice,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);

    setMastery(INITIAL_FORM.mastery);
    setDexterity(INITIAL_FORM.dexterity);
    setCookingGradeUpChance(INITIAL_FORM.cookingGradeUpChance);
    setAdditionalCookTimeReductionPercent(
      INITIAL_FORM.additionalCookTimeReductionPercent,
    );
    setAdditionalFoodDurationBonusPercent(
      INITIAL_FORM.additionalFoodDurationBonusPercent,
    );

    setPreparationMaster(INITIAL_FORM.preparationMaster);
    setBalanceOfTaste(INITIAL_FORM.balanceOfTaste);
    setGourmet(INITIAL_FORM.gourmet);
    setInstantCompletion(INITIAL_FORM.instantCompletion);
    setBanquetPreparation(INITIAL_FORM.banquetPreparation);

    setRecipeId(INITIAL_FORM.recipeId);
    setIngredientUnitPrices(createInitialIngredientPrices(INITIAL_FORM.recipeId));
    setRareIngredientFlags(createInitialRareIngredientFlags(INITIAL_FORM.recipeId));
    setNormalDishPrice(INITIAL_FORM.normalDishPrice);
    setSpecialDishPrice(INITIAL_FORM.specialDishPrice);

    setResult(calculateCooking(createInitialCalculationInput()));
    setIsDirty(false);
  };

  /**
   * 공통 가드 확인 중이거나 아직 접근이 허용되지 않은 경우
   */
  if (guardLoading || !allowed) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          요리 계산기
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      title="요리 계산기"
      left={
        <CalculatorPanel title="입력값">
          {profileLoaded && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">프로필 데이터를 불러왔습니다.</p>
              <p className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</p>
              <p className="mt-1">
                {isProUser
                  ? "→ 프로필 기반 요리 스탯/스킬 값을 수정할 수 있습니다."
                  : "→ 프로필에서 불러온 요리 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                * 도감-요리 등급업 확률은 항상 회색 비활성 입력으로 표시됩니다.
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">요리 정보</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="요리 선택">
                <SelectInput
                  value={recipeId}
                  onChange={(value) => {
                    setRecipeId(value as CookingRecipeId);
                    setIsDirty(true);
                  }}
                  options={recipeOptions}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-semibold">선택 요리: {selectedRecipe.name}</div>
              <div className="mt-1">분류: {selectedRecipe.tierLabel}</div>
              <div className="mt-1">효과: {selectedRecipe.description}</div>
              <div className="mt-1">
                기본 제작 시간: {formatSeconds(selectedRecipe.baseCraftTimeSeconds)}
              </div>
              <div className="mt-1">
                기본 성공 확률: {formatPercent(selectedRecipe.baseSuccessChancePercent)}
              </div>
              <div className="mt-1">
                기본 일품 확률: {formatPercent(selectedRecipe.baseSpecialChancePercent)}
              </div>
              <div className="mt-1">
                기본 지속시간: {formatSeconds(selectedRecipe.baseDurationSeconds, 0)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">요리 스탯</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="노련함">
                <NumberInput
                  value={mastery}
                  onChange={(value) => {
                    setMastery(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="손재주">
                <NumberInput
                  value={dexterity}
                  onChange={(value) => {
                    setDexterity(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">도감 효과</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="요리 등급업 확률">
                <NumberInput
                  value={cookingGradeUpChance}
                  onChange={() => {}}
                  disabled
                />
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">요리 스킬</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="손질 달인">
                <NumberInput
                  value={preparationMaster}
                  onChange={(value) => {
                    setPreparationMaster(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="맛의 균형">
                <NumberInput
                  value={balanceOfTaste}
                  onChange={(value) => {
                    setBalanceOfTaste(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="미식가">
                <NumberInput
                  value={gourmet}
                  onChange={(value) => {
                    setGourmet(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="즉시 완성">
                <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                  Lv.{instantCompletion}
                </div>
              </Field>

              <Field label="연회 준비">
                <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                  Lv.{banquetPreparation}
                </div>
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">재료 시세</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {selectedRecipe.ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="rounded-xl border border-zinc-200 p-3"
                >
                  <Field label={`${ingredient.name} 개당 가격 (${ingredient.quantity}개 필요)`}>
                    <NumberInput
                      value={ingredientUnitPrices[ingredient.id] ?? 0}
                      onChange={(value) => {
                        setIngredientUnitPrices((prev) => ({
                          ...prev,
                          [ingredient.id]: value,
                        }));
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={rareIngredientFlags[ingredient.id] ?? false}
                      onChange={(e) => {
                        setRareIngredientFlags((prev) => ({
                          ...prev,
                          [ingredient.id]: e.target.checked,
                        }));
                        setIsDirty(true);
                      }}
                    />
                    희귀 재료 사용
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">결과물 시세</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="일반 요리 시세">
                <NumberInput
                  value={normalDishPrice}
                  onChange={(value) => {
                    setNormalDishPrice(value);
                    setIsDirty(true);
                  }}
                />
              </Field>

              <Field label="일품 요리 시세">
                <NumberInput
                  value={specialDishPrice}
                  onChange={(value) => {
                    setSpecialDishPrice(value);
                    setIsDirty(true);
                  }}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
            <ActionButton variant="secondary" onClick={handleReset}>
              전체 초기화
            </ActionButton>
          </div>

          {isDirty && (
            <div className="mt-3 text-sm text-amber-700">
              입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
            </div>
          )}
        </CalculatorPanel>
      }
      right={
        <CalculatorPanel title="계산 결과">
          <ResultCard title="성공 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 성공 확률</span>
                <span>{formatPercent(result.baseSuccessChancePercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[노련함] 성공 보정</span>
                <span>{formatPercent(result.masterySuccessBonusPercent)}</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>최종 성공 확률</span>
                <span>{formatPercent(result.finalSuccessChancePercent)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="등급 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 일품 확률</span>
                <span>{formatPercent(result.baseSpecialChancePercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[도감] 요리 등급업 확률</span>
                <span>{formatPercent(result.codexGradeUpChancePercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[손재주] 등급업 보정</span>
                <span>{formatPercent(result.dexterityGradeUpChancePercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[미식가] 등급업 보정</span>
                <span>{formatPercent(result.gourmetGradeUpChancePercent)}</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>최종 일반 확률</span>
                <span>{formatPercent(result.finalNormalChancePercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>최종 일품 확률</span>
                <span>{formatPercent(result.finalSpecialChancePercent)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="제작 시간">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 제작 시간</span>
                <span>{formatSeconds(result.baseCraftTimeSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span>[손재주] 시간 감소</span>
                <span>{formatSeconds(result.dexterityTimeReductionSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span>[손질 달인] 추가 감소</span>
                <span>{formatPercent(result.preparationMasterReductionPercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[조리 단축] 적용값</span>
                <span>{formatPercent(result.additionalCookTimeReductionPercent)}</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>최종 제작 시간</span>
                <span>{formatSeconds(result.finalCraftTimeSeconds)}</span>
              </div>
            </div>
          </ResultCard>
          <ResultCard title="유지 시간">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 유지 시간</span>
                <span>{formatSeconds(result.baseDurationSeconds, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>[음식 효과연장]</span>
                <span>{formatPercent(result.additionalFoodDurationBonusPercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>[맛의 균형]</span>
                <span>{formatPercent(result.balanceOfTasteBonusPercent)}</span>
              </div>
              <div className="flex justify-between">
                <span>선택한 희귀 재료 수</span>
                <span>{result.selectedRareIngredientCount}개</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 재료 추가 지속시간</span>
                <span>{formatSeconds(result.rareIngredientDurationBonusSeconds, 0)}</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>최종 유지 시간</span>
                <span>{formatSeconds(result.finalDurationSeconds, 0)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="요리 효과">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 요리 효과</span>
                <span>{selectedRecipe.description}</span>
              </div>

              {result.rareEffectSummaryLines.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  적용된 희귀 재료 보너스 없음
                </div>
              ) : (
                result.rareEffectSummaryLines.map((line) => (
                  <div
                    key={line}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </ResultCard>

          <ResultCard title="기대 결과">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>재료 원가</span>
                <span>{formatNumber(result.ingredientCostPerCraft)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>1회 기대 매출</span>
                <span>{formatNumber(result.expectedRevenuePerCraft)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>1회 기대 순이익</span>
                <span>{formatNumber(result.expectedNetProfitPerCraft)}셀</span>
              </div>

              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    시간당 기대 순이익
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {Math.floor(result.expectedNetProfitPerHour).toLocaleString()}셀
                  </span>
                </div>
              </div>
            </div>
          </ResultCard>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">메모</h3>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div>
                - 현재 계산기는 "일반 결과물 vs 일품(희귀) 결과물" 2버킷으로 계산합니다.
              </div>
              <div className="mt-2">
                - 첨부 이미지 기준 희귀 결과물이 실제로 일품 요리에 해당하므로 시세 입력도 그 기준으로 받습니다.
              </div>
              <div className="mt-2">
                - 희귀 재료 보너스는 현재 v1에서 "재료 라인 1개당"으로 계산합니다.
              </div>
              <div className="mt-2">
                - 즉시 완성 / 연회 준비는 현재 수익식에 직접 반영하지 않고, 프로필 연동 및 확장 대비용으로만 보관합니다.
              </div>
            </div>
          </div>
        </CalculatorPanel>
      }
    />
  );
}