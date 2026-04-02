"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

function createInitialIngredientPrices(recipeId: CookingRecipeId): Record<string, number> {
  const recipe = getCookingRecipe(recipeId);
  return recipe.ingredients.reduce<Record<string, number>>((acc, ingredient) => {
    acc[ingredient.id] = 0;
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
      additionalCookTimeReductionPercent: INITIAL_FORM.additionalCookTimeReductionPercent,
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
  current: Record<string, number>
): Record<string, number> {
  const recipe = getCookingRecipe(recipeId);
  const next: Record<string, number> = {};

  recipe.ingredients.forEach((ingredient) => {
    next[ingredient.id] = current[ingredient.id] ?? 0;
  });

  return next;
}

export default function CookingCalculatorPage() {
  const pathname = usePathname();
  const loadingProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [mastery, setMastery] = useState(INITIAL_FORM.mastery);
  const [dexterity, setDexterity] = useState(INITIAL_FORM.dexterity);

  const [cookingGradeUpChance, setCookingGradeUpChance] = useState(
    INITIAL_FORM.cookingGradeUpChance
  );

  const [additionalCookTimeReductionPercent, setAdditionalCookTimeReductionPercent] =
    useState(INITIAL_FORM.additionalCookTimeReductionPercent);

  const [additionalFoodDurationBonusPercent, setAdditionalFoodDurationBonusPercent] =
    useState(INITIAL_FORM.additionalFoodDurationBonusPercent);

  const [preparationMaster, setPreparationMaster] = useState(
    INITIAL_FORM.preparationMaster
  );
  const [balanceOfTaste, setBalanceOfTaste] = useState(
    INITIAL_FORM.balanceOfTaste
  );
  const [gourmet, setGourmet] = useState(INITIAL_FORM.gourmet);
  const [instantCompletion, setInstantCompletion] = useState(
    INITIAL_FORM.instantCompletion
  );
  const [banquetPreparation, setBanquetPreparation] = useState(
    INITIAL_FORM.banquetPreparation
  );

  const [recipeId, setRecipeId] = useState<CookingRecipeId>(INITIAL_FORM.recipeId);
  const [ingredientUnitPrices, setIngredientUnitPrices] = useState<Record<string, number>>(
    createInitialIngredientPrices(INITIAL_FORM.recipeId)
  );
  const [normalDishPrice, setNormalDishPrice] = useState(INITIAL_FORM.normalDishPrice);
  const [specialDishPrice, setSpecialDishPrice] = useState(INITIAL_FORM.specialDishPrice);

  const [result, setResult] = useState<CookingCalculationResult>(() =>
    calculateCooking(createInitialCalculationInput())
  );
  const [isDirty, setIsDirty] = useState(false);

  const selectedRecipe = useMemo(() => getCookingRecipe(recipeId), [recipeId]);

  const isProUser = planType === "pro";
  const disableProfileFields = profileLoaded && !isProUser;

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
    };
  };

  const buildCalculationInputFromProfile = (params: {
    mastery: number;
    dexterity: number;
    cookingGradeUpChance: number;
    preparationMaster: number;
    balanceOfTaste: number;
    gourmet: number;
    instantCompletion: number;
    banquetPreparation: number;
  }): CookingCalculationInput => {
    return {
      recipeId,
      stats: {
        mastery: params.mastery,
        dexterity: params.dexterity,
        cookingGradeUpChance: params.cookingGradeUpChance,
        additionalCookTimeReductionPercent,
        additionalFoodDurationBonusPercent,
      },
      skills: {
        preparationMaster: params.preparationMaster,
        balanceOfTaste: params.balanceOfTaste,
        gourmet: params.gourmet,
        instantCompletion: params.instantCompletion,
        banquetPreparation: params.banquetPreparation,
      },
      prices: {
        normalDishPrice,
        specialDishPrice,
        ingredientUnitPrices,
      },
    };
  };

  const loadProfileToCalculator = useCallback(
    async (options?: { autoCalculate?: boolean }) => {
      if (loadingProfileRef.current) return;
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
              (def) => def.id === row.skill_id
            );
            return [matched?.skill_name_ko ?? "", row.skill_level];
          })
        );

        const nextMastery = Number(cookingProfile.mastery_total ?? INITIAL_FORM.mastery);
        const nextDexterity = Number(
          cookingProfile.dexterity_total ?? INITIAL_FORM.dexterity
        );
        const nextCookingGradeUpChance = Number(
          cookingProfile.cooking_grade_up_chance_total ??
            INITIAL_FORM.cookingGradeUpChance
        );

        const nextPreparationMaster = Number(
          skillMap["손질 달인"] ?? INITIAL_FORM.preparationMaster
        );
        const nextBalanceOfTaste = Number(
          skillMap["맛의 균형"] ?? INITIAL_FORM.balanceOfTaste
        );
        const nextGourmet = Number(skillMap["미식가"] ?? INITIAL_FORM.gourmet);
        const nextInstantCompletion = Number(
          skillMap["즉시 완성"] ?? INITIAL_FORM.instantCompletion
        );
        const nextBanquetPreparation = Number(
          skillMap["연회 준비"] ?? INITIAL_FORM.banquetPreparation
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

        if (options?.autoCalculate) {
          const nextInput = buildCalculationInputFromProfile({
            mastery: nextMastery,
            dexterity: nextDexterity,
            cookingGradeUpChance: nextCookingGradeUpChance,
            preparationMaster: nextPreparationMaster,
            balanceOfTaste: nextBalanceOfTaste,
            gourmet: nextGourmet,
            instantCompletion: nextInstantCompletion,
            banquetPreparation: nextBanquetPreparation,
          });

          const nextResult = calculateCooking(nextInput);
          setResult(nextResult);
          setIsDirty(false);
        } else {
          setIsDirty(true);
        }
      } finally {
        loadingProfileRef.current = false;
      }
    },
    [
      recipeId,
      additionalCookTimeReductionPercent,
      additionalFoodDurationBonusPercent,
      normalDishPrice,
      specialDishPrice,
      ingredientUnitPrices,
    ]
  );

  useEffect(() => {
    const handleProfileUpdated = async () => {
      await loadProfileToCalculator({ autoCalculate: true });
    };

    window.addEventListener("profileUpdated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdated);
    };
  }, [loadProfileToCalculator]);

  useEffect(() => {
    loadProfileToCalculator();
  }, [pathname, loadProfileToCalculator]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setPlanType(null);
        setProfileLoaded(false);
        return;
      }

      loadProfileToCalculator();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfileToCalculator]);

  useEffect(() => {
    setIngredientUnitPrices((prev) => syncIngredientPrices(recipeId, prev));
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
    normalDishPrice,
    specialDishPrice,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setMastery(INITIAL_FORM.mastery);
    setDexterity(INITIAL_FORM.dexterity);
    setCookingGradeUpChance(INITIAL_FORM.cookingGradeUpChance);
    setAdditionalCookTimeReductionPercent(
      INITIAL_FORM.additionalCookTimeReductionPercent
    );
    setAdditionalFoodDurationBonusPercent(
      INITIAL_FORM.additionalFoodDurationBonusPercent
    );

    setPreparationMaster(INITIAL_FORM.preparationMaster);
    setBalanceOfTaste(INITIAL_FORM.balanceOfTaste);
    setGourmet(INITIAL_FORM.gourmet);
    setInstantCompletion(INITIAL_FORM.instantCompletion);
    setBanquetPreparation(INITIAL_FORM.banquetPreparation);

    setRecipeId(INITIAL_FORM.recipeId);
    setIngredientUnitPrices(createInitialIngredientPrices(INITIAL_FORM.recipeId));
    setNormalDishPrice(INITIAL_FORM.normalDishPrice);
    setSpecialDishPrice(INITIAL_FORM.specialDishPrice);

    setResult(calculateCooking(createInitialCalculationInput()));
    setIsDirty(false);
  };

  return (
    <CalculatorLayout
      title="요리 계산기"
      left={
        <div className="space-y-6">
          {profileLoaded && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="font-semibold">프로필 데이터를 불러왔습니다.</div>
              <div className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</div>
              <div className="mt-1">
                {isProUser
                  ? "→ 프로필 기반 요리 스탯/스킬 값을 수정할 수 있습니다."
                  : "→ 프로필에서 불러온 요리 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
              </div>
              <div className="mt-2 text-xs text-blue-700">
                * 도감-요리 등급업 확률은 항상 회색 비활성 입력으로 표시됩니다.
              </div>
            </div>
          )}

          <CalculatorPanel title="요리 스탯">
            <div className="space-y-4">
              <Field label="노련함">
                <NumberInput
                  value={mastery}
                  min={0}
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
                  min={0}
                  onChange={(value) => {
                    setDexterity(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="도감 효과">
            <div className="space-y-4">
              <Field label="요리 등급업 확률">
                <NumberInput
                  value={cookingGradeUpChance}
                  min={0}
                  disabled
                  onChange={() => {}}
                />
              </Field>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="추가 보정">
            <div className="space-y-4">
              <Field label="조리 단축(%)">
                <NumberInput
                  value={additionalCookTimeReductionPercent}
                  min={0}
                  onChange={(value) => {
                    setAdditionalCookTimeReductionPercent(value);
                    setIsDirty(true);
                  }}
                />
              </Field>

              <Field label="음식 효과연장(%)">
                <NumberInput
                  value={additionalFoodDurationBonusPercent}
                  min={0}
                  onChange={(value) => {
                    setAdditionalFoodDurationBonusPercent(value);
                    setIsDirty(true);
                  }}
                />
              </Field>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="요리 스킬">
            <div className="space-y-4">
              <Field label="손질 달인">
                <NumberInput
                  value={preparationMaster}
                  min={0}
                  max={30}
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
                  min={0}
                  max={30}
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
                  min={0}
                  max={30}
                  onChange={(value) => {
                    setGourmet(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="즉시 완성">
                <NumberInput
                  value={instantCompletion}
                  min={0}
                  max={30}
                  onChange={(value) => {
                    setInstantCompletion(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="연회 준비">
                <NumberInput
                  value={banquetPreparation}
                  min={0}
                  max={30}
                  onChange={(value) => {
                    setBanquetPreparation(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="레시피 선택">
            <div className="space-y-4">
              <Field label="요리">
                <SelectInput
                  value={recipeId}
                  options={recipeOptions}
                  onChange={(value) => {
                    setRecipeId(value as CookingRecipeId);
                    setIsDirty(true);
                  }}
                />
              </Field>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <div className="font-semibold">
                  선택 요리: {selectedRecipe.name}
                </div>
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
          </CalculatorPanel>

          <CalculatorPanel title="재료 시세">
            <div className="space-y-4">
              {selectedRecipe.ingredients.map((ingredient) => (
                <Field
                  key={ingredient.id}
                  label={`${ingredient.name} (${ingredient.quantity}개)`}
                >
                  <NumberInput
                    value={ingredientUnitPrices[ingredient.id] ?? 0}
                    min={0}
                    onChange={(value) => {
                      setIngredientUnitPrices((prev) => ({
                        ...prev,
                        [ingredient.id]: value,
                      }));
                      setIsDirty(true);
                    }}
                  />
                </Field>
              ))}
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="결과물 시세">
            <div className="space-y-4">
              <Field label="일반 요리 시세">
                <NumberInput
                  value={normalDishPrice}
                  min={0}
                  onChange={(value) => {
                    setNormalDishPrice(value);
                    setIsDirty(true);
                  }}
                />
              </Field>

              <Field label="일품 요리 시세">
                <NumberInput
                  value={specialDishPrice}
                  min={0}
                  onChange={(value) => {
                    setSpecialDishPrice(value);
                    setIsDirty(true);
                  }}
                />
              </Field>
            </div>
          </CalculatorPanel>

          <div className="flex gap-3">
            <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
            <ActionButton variant="secondary" onClick={handleReset}>
              전체 초기화
            </ActionButton>
          </div>

          {isDirty && (
            <div className="text-sm text-amber-600">
              입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
            </div>
          )}
        </div>
      }
      right={
        <div className="space-y-4">
          <ResultCard title="레시피 기본값">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>기본 일품 확률: {formatPercent(result.baseSpecialChancePercent)}</div>
              <div>기본 성공 확률: {formatPercent(result.baseSuccessChancePercent)}</div>
              <div>기본 제작 시간: {formatSeconds(result.baseCraftTimeSeconds)}</div>
              <div>기본 유지 시간: {formatSeconds(result.baseDurationSeconds, 0)}</div>
            </div>
          </ResultCard>

          <ResultCard title="등급 / 성공 확률">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>[도감] 요리 등급업 확률 {formatPercent(result.codexGradeUpChancePercent)}</div>
              <div>[손재주] 등급업 보정 {formatPercent(result.dexterityGradeUpChancePercent)}</div>
              <div>[미식가] 등급업 보정 {formatPercent(result.gourmetGradeUpChancePercent)}</div>
              <div className="border-t border-zinc-200 pt-2 font-medium text-zinc-900">
                최종 일반 확률: {formatPercent(result.finalNormalChancePercent)}
              </div>
              <div className="font-medium text-zinc-900">
                최종 일품 확률: {formatPercent(result.finalSpecialChancePercent)}
              </div>

              <div className="border-t border-zinc-200 pt-2">
                [노련함] 성공 보정 {formatPercent(result.masterySuccessBonusPercent)}
              </div>
              <div className="font-medium text-zinc-900">
                최종 성공 확률: {formatPercent(result.finalSuccessChancePercent)}
              </div>
            </div>
          </ResultCard>

          <ResultCard title="시간 / 유지시간">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>[손재주] 시간 감소 {formatSeconds(result.dexterityTimeReductionSeconds)}</div>
              <div>[손질 달인] 추가 감소 {formatPercent(result.preparationMasterReductionPercent)}</div>
              <div>[조리 단축] 적용값 {formatPercent(result.additionalCookTimeReductionPercent)}</div>
              <div className="border-t border-zinc-200 pt-2 font-medium text-zinc-900">
                최종 제작 시간: {formatSeconds(result.finalCraftTimeSeconds)}
              </div>

              <div className="border-t border-zinc-200 pt-2">
                [음식 효과연장] {formatPercent(result.additionalFoodDurationBonusPercent)}
              </div>
              <div>[맛의 균형] {formatPercent(result.balanceOfTasteBonusPercent)}</div>
              <div className="font-medium text-zinc-900">
                최종 유지 시간: {formatSeconds(result.finalDurationSeconds, 0)}
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 수익">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>재료 원가: {formatNumber(result.ingredientCostPerCraft)}셀</div>
              <div>1회 기대 매출: {formatNumber(result.expectedRevenuePerCraft)}셀</div>
              <div className="font-semibold text-zinc-900">
                1회 기대 순이익: {formatNumber(result.expectedNetProfitPerCraft)}셀
              </div>
              <div className="border-t border-zinc-200 pt-2 font-semibold text-zinc-900">
                시간당 기대 순이익: {formatNumber(result.expectedNetProfitPerHour)}셀
              </div>
            </div>
          </ResultCard>

          <ResultCard title="메모">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>- 현재 계산기는 “일반 결과물 vs 일품(희귀) 결과물” 2버킷으로 계산합니다.</div>
              <div>- 네 첨부 이미지 기준 희귀 결과물이 실제로 일품 요리에 해당하므로 시세 입력도 그 기준으로 받습니다.</div>
              <div>- 즉시 완성 / 연회 준비는 현재 수익식에 직접 반영하지 않고, 프로필 구조와 확장성을 위해 값만 연동합니다.</div>
            </div>
          </ResultCard>
        </div>
      }
    />
  );
}