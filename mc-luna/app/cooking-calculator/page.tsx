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
import {
  BALANCE_OF_TASTE_DURATION_BONUS,
  BANQUET_PREPARATION_TABLE,
  INSTANT_COMPLETION_TABLE,
  PREPARATION_MASTER_TIME_REDUCTION,
} from "@/src/lib/cooking/skillTables";
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
  cookingGradeUpChance: 0,

  preparationMaster: 0,
  balanceOfTaste: 0,
  gourmet: 0,
  instantCompletion: 0,
  banquetPreparation: 0,

  recipeId: "ssambap" as CookingRecipeId,
  useInstantCompletion: false,
  useBanquetPreparation: false,

  normalDishPrice: 100,
  specialDishPrice: 150,
};

function buildInitialIngredientPrices(recipeId: CookingRecipeId): Record<string, number> {
  const recipe = getCookingRecipe(recipeId);
  return recipe.ingredients.reduce<Record<string, number>>((acc, ingredient) => {
    acc[ingredient.id] = 0;
    return acc;
  }, {});
}

function createInitialCalculationInput(): CookingCalculationInput {
  return {
    stats: {
      mastery: INITIAL_FORM.mastery,
      dexterity: INITIAL_FORM.dexterity,
      cookingGradeUpChance: INITIAL_FORM.cookingGradeUpChance,
    },
    skills: {
      preparationMaster: INITIAL_FORM.preparationMaster,
      balanceOfTaste: INITIAL_FORM.balanceOfTaste,
      gourmet: INITIAL_FORM.gourmet,
      instantCompletion: INITIAL_FORM.instantCompletion,
      banquetPreparation: INITIAL_FORM.banquetPreparation,
    },
    environment: {
      recipeId: INITIAL_FORM.recipeId,
      useInstantCompletion: INITIAL_FORM.useInstantCompletion,
      useBanquetPreparation: INITIAL_FORM.useBanquetPreparation,
    },
    prices: {
      normalDishPrice: INITIAL_FORM.normalDishPrice,
      specialDishPrice: INITIAL_FORM.specialDishPrice,
      ingredientUnitPrices: buildInitialIngredientPrices(INITIAL_FORM.recipeId),
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

function formatSeconds(value: number | null): string {
  if (value == null) return "-";
  return `${formatNumber(value, 0)}초`;
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

  /**
   * 도감 효과
   * - 요리 등급업 확률
   * - 프로필에서 자동 불러오며 계산에 반영
   * - 직접 수정은 비활성
   */
  const [cookingGradeUpChance, setCookingGradeUpChance] = useState(
    INITIAL_FORM.cookingGradeUpChance
  );

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
  const [useInstantCompletion, setUseInstantCompletion] = useState(
    INITIAL_FORM.useInstantCompletion
  );
  const [useBanquetPreparation, setUseBanquetPreparation] = useState(
    INITIAL_FORM.useBanquetPreparation
  );

  const [ingredientUnitPrices, setIngredientUnitPrices] = useState<Record<string, number>>(
    buildInitialIngredientPrices(INITIAL_FORM.recipeId)
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
      stats: {
        mastery,
        dexterity,
        cookingGradeUpChance,
      },
      skills: {
        preparationMaster,
        balanceOfTaste,
        gourmet,
        instantCompletion,
        banquetPreparation,
      },
      environment: {
        recipeId,
        useInstantCompletion,
        useBanquetPreparation,
      },
      prices: {
        normalDishPrice,
        specialDishPrice,
        ingredientUnitPrices,
      },
    };
  };

  const loadProfileToCalculator = useCallback(async () => {
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

      setMastery(Number(cookingProfile.mastery_total ?? INITIAL_FORM.mastery));
      setDexterity(Number(cookingProfile.dexterity_total ?? INITIAL_FORM.dexterity));
      setCookingGradeUpChance(
        Number(
          cookingProfile.cooking_grade_up_chance_total ??
            INITIAL_FORM.cookingGradeUpChance
        )
      );

      setPreparationMaster(
        Number(skillMap["손질 달인"] ?? INITIAL_FORM.preparationMaster)
      );
      setBalanceOfTaste(
        Number(skillMap["맛의 균형"] ?? INITIAL_FORM.balanceOfTaste)
      );
      setGourmet(Number(skillMap["미식가"] ?? INITIAL_FORM.gourmet));
      setInstantCompletion(
        Number(skillMap["즉시 완성"] ?? INITIAL_FORM.instantCompletion)
      );
      setBanquetPreparation(
        Number(skillMap["연회 준비"] ?? INITIAL_FORM.banquetPreparation)
      );

      setPlanType(nextPlanType);
      setProfileLoaded(true);
      setIsDirty(true);
    } finally {
      loadingProfileRef.current = false;
    }
  }, []);

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
    const handleProfileUpdated = async () => {
      await loadProfileToCalculator();
      setTimeout(() => {
        const nextResult = calculateCooking(buildCalculationInput());
        setResult(nextResult);
        setIsDirty(false);
      }, 0);
    };

    window.addEventListener("profileUpdated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdated);
    };
  }, [
    loadProfileToCalculator,
    mastery,
    dexterity,
    cookingGradeUpChance,
    preparationMaster,
    balanceOfTaste,
    gourmet,
    instantCompletion,
    banquetPreparation,
    recipeId,
    useInstantCompletion,
    useBanquetPreparation,
    normalDishPrice,
    specialDishPrice,
    ingredientUnitPrices,
  ]);

  useEffect(() => {
    setIngredientUnitPrices((prev) => syncIngredientPrices(recipeId, prev));
  }, [recipeId]);

  useEffect(() => {
    if (instantCompletion <= 0 && useInstantCompletion) {
      setUseInstantCompletion(false);
      setIsDirty(true);
    }
  }, [instantCompletion, useInstantCompletion]);

  useEffect(() => {
    if (banquetPreparation <= 0 && useBanquetPreparation) {
      setUseBanquetPreparation(false);
      setIsDirty(true);
    }
  }, [banquetPreparation, useBanquetPreparation]);

  const handleCalculate = useCallback(() => {
    const nextResult = calculateCooking(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  }, [
    mastery,
    dexterity,
    cookingGradeUpChance,
    preparationMaster,
    balanceOfTaste,
    gourmet,
    instantCompletion,
    banquetPreparation,
    recipeId,
    useInstantCompletion,
    useBanquetPreparation,
    normalDishPrice,
    specialDishPrice,
    ingredientUnitPrices,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setMastery(INITIAL_FORM.mastery);
    setDexterity(INITIAL_FORM.dexterity);
    setCookingGradeUpChance(INITIAL_FORM.cookingGradeUpChance);

    setPreparationMaster(INITIAL_FORM.preparationMaster);
    setBalanceOfTaste(INITIAL_FORM.balanceOfTaste);
    setGourmet(INITIAL_FORM.gourmet);
    setInstantCompletion(INITIAL_FORM.instantCompletion);
    setBanquetPreparation(INITIAL_FORM.banquetPreparation);

    setRecipeId(INITIAL_FORM.recipeId);
    setUseInstantCompletion(INITIAL_FORM.useInstantCompletion);
    setUseBanquetPreparation(INITIAL_FORM.useBanquetPreparation);

    setIngredientUnitPrices(buildInitialIngredientPrices(INITIAL_FORM.recipeId));
    setNormalDishPrice(INITIAL_FORM.normalDishPrice);
    setSpecialDishPrice(INITIAL_FORM.specialDishPrice);

    setResult(calculateCooking(createInitialCalculationInput()));
    setIsDirty(false);
  };

  const banquetInfo =
    BANQUET_PREPARATION_TABLE[banquetPreparation] ?? BANQUET_PREPARATION_TABLE[0];
  const instantInfo =
    INSTANT_COMPLETION_TABLE[instantCompletion] ?? INSTANT_COMPLETION_TABLE[0];
  const preparationReduction =
    PREPARATION_MASTER_TIME_REDUCTION[preparationMaster] ?? 0;
  const balanceDuration =
    BALANCE_OF_TASTE_DURATION_BONUS[balanceOfTaste] ?? 0;

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

              <Field
                label="즉시 완성"
                hint={
                  <div className="text-xs text-zinc-500">
                    Lv.{instantCompletion} / 발동 확률 {instantInfo.chancePercent}% / 지속{" "}
                    {instantInfo.durationSeconds}초
                  </div>
                }
              >
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

              <Field
                label="연회 준비"
                hint={
                  <div className="text-xs text-zinc-500">
                    Lv.{banquetPreparation} / 다중 요리 확률 {banquetInfo.chancePercent}% /
                    추가 요리 {banquetInfo.extraCount}회
                  </div>
                }
              >
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
                <div className="mt-1">{selectedRecipe.description}</div>
                <div className="mt-1">분류: {selectedRecipe.tierLabel}</div>
                <div className="mt-1">
                  기본 지속시간:{" "}
                  {selectedRecipe.baseBuffDurationSeconds == null
                    ? "-"
                    : `${selectedRecipe.baseBuffDurationSeconds}초`}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={useBanquetPreparation}
                  disabled={banquetPreparation <= 0}
                  onChange={(e) => {
                    setUseBanquetPreparation(e.target.checked);
                    setIsDirty(true);
                  }}
                />
                연회 준비 발동 상태로 계산
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={useInstantCompletion}
                  disabled={instantCompletion <= 0}
                  onChange={(e) => {
                    setUseInstantCompletion(e.target.checked);
                    setIsDirty(true);
                  }}
                />
                즉시 완성 발동 상태 참고 표시
              </label>
            </div>
          </CalculatorPanel>

          <CalculatorPanel title="재료 시세">
            <div className="space-y-4">
              {selectedRecipe.ingredients.map((ingredient) => (
                <Field
                  key={ingredient.id}
                  label={`${ingredient.name} (${ingredient.quantity}개 필요)`}
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
          <ResultCard title="등급 확률">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>손재주-등급업 확률: {formatPercent(result.intermediate.dexteritySpecialChancePercent)}</div>
              <div>도감-요리 등급업 확률: {formatPercent(result.intermediate.codexSpecialChancePercent)}</div>
              <div>미식가-고등급 확률: {formatPercent(result.intermediate.gourmetSpecialChancePercent)}</div>
              <div className="border-t border-zinc-200 pt-2 font-medium text-zinc-900">
                일반 요리 확률: {formatPercent(result.intermediate.totalNormalChancePercent)}
              </div>
              <div className="font-medium text-zinc-900">
                일품 요리 확률: {formatPercent(result.intermediate.totalSpecialChancePercent)}
              </div>
            </div>
          </ResultCard>

          <ResultCard title="추가 제작 / 성공 판정">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>노련함 기반 성공률: {formatPercent(result.intermediate.masterySuccessRatePercent)}</div>
              <div>연회 준비 발동 확률: {formatPercent(result.intermediate.banquetChancePercent)}</div>
              <div>연회 준비 추가 횟수: {result.intermediate.banquetExtraCount}회</div>
              <div className="border-t border-zinc-200 pt-2 font-medium text-zinc-900">
                1회 제작 기대 산출량: {formatNumber(result.intermediate.expectedOutputMultiplier, 4)}개
              </div>
              <div>일반 기대 개수: {formatNumber(result.expectedNormalCount, 4)}개</div>
              <div>일품 기대 개수: {formatNumber(result.expectedSpecialCount, 4)}개</div>
              <div>총 기대 개수: {formatNumber(result.expectedTotalOutputCount, 4)}개</div>
            </div>
          </ResultCard>

          <ResultCard title="시간 / 지속시간 참고">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>손재주-시간 감소율: {formatPercent(result.intermediate.dexterityTimeReductionPercent)}</div>
              <div>손질 달인-시간 감소율: {formatPercent(result.intermediate.preparationTimeReductionPercent)}</div>
              <div className="font-medium text-zinc-900">
                최종 상대 시간 감소율: {formatPercent(result.intermediate.relativeCookTimeReductionPercent)}
              </div>
              <div>상대 시간 배율: {formatNumber(result.intermediate.relativeCookTimeMultiplier, 4)}배</div>
              <div className="border-t border-zinc-200 pt-2">
                맛의 균형 지속시간 증가: {formatPercent(balanceDuration)}
              </div>
              <div>기본 버프 지속시간: {formatSeconds(result.intermediate.baseBuffDurationSeconds)}</div>
              <div>최종 버프 지속시간: {formatSeconds(result.intermediate.finalBuffDurationSeconds)}</div>
              <div className="border-t border-zinc-200 pt-2">
                즉시 완성 확률: {useInstantCompletion ? formatPercent(instantInfo.chancePercent) : "비활성"}
              </div>
            </div>
          </ResultCard>

          <ResultCard title="비용 / 기대수익">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>재료 원가: {formatNumber(result.intermediate.ingredientCostPerCraft)}원</div>
              <div>기대 매출: {formatNumber(result.expectedRevenuePerCraft)}원</div>
              <div className="font-semibold text-zinc-900">
                기대 순이익: {formatNumber(result.expectedNetProfitPerCraft)}원
              </div>
            </div>
          </ResultCard>

          <ResultCard title="v1 계산 기준 메모">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>
                - 현재 계산기는 일반 vs 일품 2버킷 구조로 계산합니다.
              </div>
              <div>
                - 은별/금별을 따로 나누고 싶다면 다음 단계에서 일품 내부를 2단계로 분리하면 됩니다.
              </div>
              <div>
                - 손재주/노련함의 정확한 서버식이 위키에 공개되지 않은 부분은 calc.ts 상단 상수로 분리해 두었습니다.
              </div>
            </div>
          </ResultCard>
        </div>
      }
    />
  );
}