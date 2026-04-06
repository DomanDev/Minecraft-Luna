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

import { useRequireProfile } from "@/src/hooks/useRequireProfile";
import { toast } from "sonner";

import { calculateMining } from "@/src/lib/mining/calc";
import {
  MINING_RECIPES,
  getMiningRecipe,
  type MiningRecipeId,
} from "@/src/lib/mining/recipes";
import type {
  MiningCalculationInput,
  MiningCalculationResult,
} from "@/src/lib/mining/types";

import {
  loadUserMarketPrices,
  upsertUserMarketPrices,
} from "@/src/lib/market/db";
import type {
  MarketGrade,
  UserMarketPriceRow,
} from "@/src/lib/market/types";
import { MINING_MARKET_ITEMS } from "@/src/lib/market/defaultPrices";
import { formatCell, formatDecimal, formatPercent } from "@/src/lib/format";

const recipeOptions = MINING_RECIPES.map((recipe) => ({
  value: recipe.id,
  label: `${recipe.name} (${recipe.tierLabel})`,
}));

const INITIAL_FORM = {
  dexterity: 0,
  recipeId: "mithril_ingot" as MiningRecipeId,
};

function pickDefaultMiningPrice(itemKey: string, grade: MarketGrade): number | null {
  const matched = MINING_MARKET_ITEMS.find((item) => item.key === itemKey);

  if (!matched) return null;

  const value = matched.prices[grade];
  return typeof value === "number" ? value : null;
}

function createInitialIngredientPrices(
  recipeId: MiningRecipeId,
): Record<string, number> {
  const recipe = getMiningRecipe(recipeId);

  return recipe.ingredients.reduce<Record<string, number>>((acc, ingredient) => {
    const price = pickDefaultMiningPrice(ingredient.itemKey, ingredient.grade);
    acc[`${ingredient.itemKey}:${ingredient.grade}`] =
      typeof price === "number" ? price : 0;
    return acc;
  }, {});
}

function createInitialResultPrices(
  recipeId: MiningRecipeId,
): Record<string, number> {
  const recipe = getMiningRecipe(recipeId);

  if (recipe.resultGradeType === "triple") {
    return {
      [`${recipe.resultItemKey}:normal`]:
        pickDefaultMiningPrice(recipe.resultItemKey, "normal") ?? 0,
      [`${recipe.resultItemKey}:advanced`]:
        pickDefaultMiningPrice(recipe.resultItemKey, "advanced") ?? 0,
      [`${recipe.resultItemKey}:rare`]:
        pickDefaultMiningPrice(recipe.resultItemKey, "rare") ?? 0,
    };
  }

  return {
    [`${recipe.resultItemKey}:single`]:
      pickDefaultMiningPrice(recipe.resultItemKey, "single") ?? 0,
  };
}

function createInitialCalculationInput(): MiningCalculationInput {
  return {
    recipeId: INITIAL_FORM.recipeId,
    dexterity: INITIAL_FORM.dexterity,
    prices: {
      ingredientUnitPrices: createInitialIngredientPrices(INITIAL_FORM.recipeId),
      resultPrices: createInitialResultPrices(INITIAL_FORM.recipeId),
    },
  };
}

function formatSeconds(seconds: number, digits = 2): string {
  return `${formatDecimal(seconds, digits)}초`;
}

export default function MiningCalculatorPage() {
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "광부 계산기를 사용하려면 로그인이 필요합니다.",
    profileMessage: "광부 계산기를 사용하려면 프로필 연동이 필요합니다.",
  });

  const loadingProfileRef = useRef(false);
  const hasLoadedProfileRef = useRef(false);
  const loadingMarketPriceRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [dexterity, setDexterity] = useState(INITIAL_FORM.dexterity);
  const [recipeId, setRecipeId] = useState<MiningRecipeId>(INITIAL_FORM.recipeId);

  const [ingredientUnitPrices, setIngredientUnitPrices] = useState<
    Record<string, number>
  >(createInitialIngredientPrices(INITIAL_FORM.recipeId));

  const [resultPrices, setResultPrices] = useState<Record<string, number>>(
    createInitialResultPrices(INITIAL_FORM.recipeId),
  );

  const [result, setResult] = useState<MiningCalculationResult>(() =>
    calculateMining(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const selectedRecipe = useMemo(() => getMiningRecipe(recipeId), [recipeId]);
  const isProUser = planType === "pro";
  const disableProfileFields = planType !== "pro";

  const buildCalculationInput = (): MiningCalculationInput => ({
    recipeId,
    dexterity,
    prices: {
      ingredientUnitPrices,
      resultPrices,
    },
  });

  const applySavedMarketPriceToCalculator = useCallback(
    async (targetRecipeId: MiningRecipeId) => {
      if (loadingMarketPriceRef.current) return;
      if (guardLoading || !allowed) return;

      loadingMarketPriceRef.current = true;

      try {
        const recipe = getMiningRecipe(targetRecipeId);

        const nextIngredientPrices = createInitialIngredientPrices(targetRecipeId);
        const nextResultPrices = createInitialResultPrices(targetRecipeId);

        if (planType !== "pro") {
          setIngredientUnitPrices(nextIngredientPrices);
          setResultPrices(nextResultPrices);
          setIsDirty(true);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;
        if (!user) return;

        const miningRows = await loadUserMarketPrices(user.id, "mining");

        recipe.ingredients.forEach((ingredient) => {
          const key = `${ingredient.itemKey}:${ingredient.grade}`;

          const saved = miningRows.find(
            (row) =>
              row.item_key === ingredient.itemKey &&
              row.grade === ingredient.grade,
          );

          if (saved && typeof saved.price === "number") {
            nextIngredientPrices[key] = saved.price;
          }
        });

        if (recipe.resultGradeType === "triple") {
          (["normal", "advanced", "rare"] as const).forEach((grade) => {
            const saved = miningRows.find(
              (row) =>
                row.item_key === recipe.resultItemKey &&
                row.grade === grade,
            );

            if (saved && typeof saved.price === "number") {
              nextResultPrices[`${recipe.resultItemKey}:${grade}`] = saved.price;
            }
          });
        } else {
          const saved = miningRows.find(
            (row) =>
              row.item_key === recipe.resultItemKey &&
              row.grade === "single",
          );

          if (saved && typeof saved.price === "number") {
            nextResultPrices[`${recipe.resultItemKey}:single`] = saved.price;
          }
        }

        setIngredientUnitPrices(nextIngredientPrices);
        setResultPrices(nextResultPrices);
        setIsDirty(true);
      } catch (error) {
        console.error("광부 시세 자동 불러오기 실패:", error);
      } finally {
        loadingMarketPriceRef.current = false;
      }
    },
    [allowed, guardLoading, planType],
  );

  const handleSaveCurrentRecipePrice = useCallback(async () => {
    if (!isProUser) {
      toast.error("레시피 시세 저장은 Pro 사용자만 가능합니다.");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      const rows: UserMarketPriceRow[] = [];

      selectedRecipe.ingredients.forEach((ingredient) => {
        rows.push({
          user_id: user.id,
          category: "mining",
          item_key: ingredient.itemKey,
          grade: ingredient.grade,
          price:
            ingredientUnitPrices[
              `${ingredient.itemKey}:${ingredient.grade}`
            ] ?? 0,
        });
      });

      if (selectedRecipe.resultGradeType === "triple") {
        (["normal", "advanced", "rare"] as const).forEach((grade) => {
          rows.push({
            user_id: user.id,
            category: "mining",
            item_key: selectedRecipe.resultItemKey,
            grade,
            price: resultPrices[`${selectedRecipe.resultItemKey}:${grade}`] ?? 0,
          });
        });
      } else {
        rows.push({
          user_id: user.id,
          category: "mining",
          item_key: selectedRecipe.resultItemKey,
          grade: "single",
          price: resultPrices[`${selectedRecipe.resultItemKey}:single`] ?? 0,
        });
      }

      await upsertUserMarketPrices(rows);

      toast.success("현재 레시피 재료/결과물 시세를 저장했습니다.");
      await applySavedMarketPriceToCalculator(recipeId);
    } catch (error) {
      console.error("광부 시세 저장 실패:", error);
      toast.error("시세 저장 중 오류가 발생했습니다.");
    }
  }, [
    isProUser,
    selectedRecipe,
    ingredientUnitPrices,
    resultPrices,
    recipeId,
    applySavedMarketPriceToCalculator,
  ]);

  const loadProfileToCalculator = useCallback(async () => {
    if (loadingProfileRef.current) return;
    if (hasLoadedProfileRef.current) return;

    loadingProfileRef.current = true;

    try {
      let user = null;

      for (let i = 0; i < 5; i++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

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
      setPlanType(nextPlanType);

      const { data: miningProfile, error: miningProfileError } = await supabase
        .from("mining_profiles")
        .select("dexterity_total")
        .eq("user_id", user.id)
        .single();

      if (miningProfileError) {
        console.warn("mining_profiles 조회 실패:", miningProfileError.message);
      }

      const nextDexterity = Number(
        miningProfile?.dexterity_total ?? INITIAL_FORM.dexterity,
      );

      setDexterity(nextDexterity);
      setProfileLoaded(Boolean(miningProfile));
      hasLoadedProfileRef.current = true;

      setResult(
        calculateMining({
          recipeId,
          dexterity: nextDexterity,
          prices: {
            ingredientUnitPrices,
            resultPrices,
          },
        }),
      );
      setIsDirty(false);
    } finally {
      loadingProfileRef.current = false;
    }
  }, [recipeId, ingredientUnitPrices, resultPrices]);

  useEffect(() => {
    if (guardLoading || !allowed) return;
    void loadProfileToCalculator();
  }, [guardLoading, allowed, loadProfileToCalculator]);

  useEffect(() => {
    if (guardLoading || !allowed) return;
    void applySavedMarketPriceToCalculator(recipeId);
  }, [guardLoading, allowed, recipeId, applySavedMarketPriceToCalculator]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setPlanType(null);
        setProfileLoaded(false);
        hasLoadedProfileRef.current = false;
        return;
      }

      if (!hasLoadedProfileRef.current) {
        void loadProfileToCalculator();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfileToCalculator]);

  useEffect(() => {
    setIngredientUnitPrices(createInitialIngredientPrices(recipeId));
    setResultPrices(createInitialResultPrices(recipeId));
  }, [recipeId]);

  const handleCalculate = useCallback(() => {
    setResult(calculateMining(buildCalculationInput()));
    setIsDirty(false);
  }, [recipeId, dexterity, ingredientUnitPrices, resultPrices]);

  const handleReset = useCallback(() => {
    setProfileLoaded(false);
    setDexterity(INITIAL_FORM.dexterity);
    setRecipeId(INITIAL_FORM.recipeId);
    setIngredientUnitPrices(createInitialIngredientPrices(INITIAL_FORM.recipeId));
    setResultPrices(createInitialResultPrices(INITIAL_FORM.recipeId));
    setResult(calculateMining(createInitialCalculationInput()));
    setIsDirty(false);
  }, []);

  const primaryProfit =
    result.furnace?.expectedNetProfitPerCraft ??
    result.synthesis?.expectedNetProfitPerCraft ??
    0;

  const isNegativeProfit = primaryProfit < 0;

  if (guardLoading || !allowed) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          광부 계산기
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      title="광부 계산기"
      left={
        <CalculatorPanel title="입력값">
          {profileLoaded && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">프로필 데이터를 불러왔습니다.</p>
              <p className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</p>
              <p className="mt-1">
                {isProUser
                  ? "→ 프로필 기반 손재주 값을 수정할 수 있습니다."
                  : "→ 프로필에서 불러온 손재주 값은 수정할 수 없습니다. (Pro 전용)"}
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">재련 정보</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="레시피 선택">
                <SelectInput
                  value={recipeId}
                  onChange={(value) => {
                    setRecipeId(value as MiningRecipeId);
                    setIsDirty(true);
                  }}
                  options={recipeOptions}
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

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-semibold">선택 레시피: {selectedRecipe.name}</div>
              <div className="mt-1">분류: {selectedRecipe.tierLabel}</div>
              <div className="mt-1">설명: {selectedRecipe.description}</div>
              {selectedRecipe.baseInfoLines.map((line) => (
                <div key={line} className="mt-1">
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">재료 시세</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {selectedRecipe.ingredients.map((ingredient) => {
                const priceKey = `${ingredient.itemKey}:${ingredient.grade}`;

                return (
                  <Field
                    key={priceKey}
                    label={`${ingredient.name} (${ingredient.quantity}개 필요)`}
                  >
                    <NumberInput
                      value={ingredientUnitPrices[priceKey] ?? 0}
                      onChange={(value) => {
                        setIngredientUnitPrices((prev) => ({
                          ...prev,
                          [priceKey]: value,
                        }));
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">결과물 시세</h3>

            {selectedRecipe.resultGradeType === "triple" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="일반 결과물 시세">
                  <NumberInput
                    value={resultPrices[`${selectedRecipe.resultItemKey}:normal`] ?? 0}
                    onChange={(value) => {
                      setResultPrices((prev) => ({
                        ...prev,
                        [`${selectedRecipe.resultItemKey}:normal`]: value,
                      }));
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="고급 결과물 시세">
                  <NumberInput
                    value={resultPrices[`${selectedRecipe.resultItemKey}:advanced`] ?? 0}
                    onChange={(value) => {
                      setResultPrices((prev) => ({
                        ...prev,
                        [`${selectedRecipe.resultItemKey}:advanced`]: value,
                      }));
                      setIsDirty(true);
                    }}
                  />
                </Field>

                <Field label="희귀 결과물 시세">
                  <NumberInput
                    value={resultPrices[`${selectedRecipe.resultItemKey}:rare`] ?? 0}
                    onChange={(value) => {
                      setResultPrices((prev) => ({
                        ...prev,
                        [`${selectedRecipe.resultItemKey}:rare`]: value,
                      }));
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="결과물 시세">
                  <NumberInput
                    value={resultPrices[`${selectedRecipe.resultItemKey}:single`] ?? 0}
                    onChange={(value) => {
                      setResultPrices((prev) => ({
                        ...prev,
                        [`${selectedRecipe.resultItemKey}:single`]: value,
                      }));
                      setIsDirty(true);
                    }}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              onClick={handleSaveCurrentRecipePrice}
              disabled={!isProUser}
            >
              현재 레시피 시세 저장
            </ActionButton>
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
          <ResultCard title="제작 정보">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>현재 레시피</span>
                <span>{result.recipeName}</span>
              </div>
              <div className="flex justify-between">
                <span>제작 방식</span>
                <span>
                  {result.recipeKind === "furnace"
                    ? "허름한 화로 재련"
                    : "벨리움 합성"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>손재주 입력값</span>
                <span>{formatDecimal(result.dexterity, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>반올림 적용 손재주</span>
                <span>{result.roundedDexterity}</span>
              </div>
              <div className="flex justify-between">
                <span>기본 제작 시간</span>
                <span>{formatSeconds(result.baseCraftTimeSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span>최종 제작 시간</span>
                <span>{formatSeconds(result.finalCraftTimeSeconds)}</span>
              </div>
            </div>
          </ResultCard>

          {result.furnace && (
            <>
              <ResultCard title="결과물 확률">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>기본 성공 확률</span>
                    <span>{formatPercent(result.furnace.baseSuccessChancePercent)}</span>
                  </div>
                  <div className="border-t border-gray-800/20 my-2" />
                  <div className="flex justify-between">
                    <span>일반 가중치</span>
                    <span>{result.furnace.normalWeight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>고급 가중치</span>
                    <span>{result.furnace.advancedWeight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>희귀 가중치</span>
                    <span>{result.furnace.rareWeight}</span>
                  </div>
                  <div className="border-t border-gray-800/20 my-2" />
                  <div className="flex justify-between">
                    <span>일반 확률</span>
                    <span>{formatPercent(result.furnace.normalChancePercent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>고급 확률</span>
                    <span>{formatPercent(result.furnace.advancedChancePercent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>희귀 확률</span>
                    <span>{formatPercent(result.furnace.rareChancePercent)}</span>
                  </div>
                </div>
              </ResultCard>

              <ResultCard title="수익 계산">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>1회 제작 재료 원가</span>
                    <span>{formatCell(result.ingredientCostPerCraft)}셀</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1회 제작 기대 매출</span>
                    <span>{formatCell(result.furnace.expectedRevenuePerCraft)}셀</span>
                  </div>

                  <div
                    className={`mt-3 rounded-xl px-4 py-3 ${
                      isNegativeProfit
                        ? "border border-red-200 bg-red-50"
                        : "border border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold ${
                          isNegativeProfit ? "text-red-900" : "text-blue-900"
                        }`}
                      >
                        1회 제작 기대 순이익
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          isNegativeProfit ? "text-red-700" : "text-blue-700"
                        }`}
                      >
                        {formatCell(result.furnace.expectedNetProfitPerCraft)}셀
                      </span>
                    </div>
                  </div>
                </div>
              </ResultCard>
            </>
          )}

          {result.synthesis && (
            <>
              <ResultCard title="결과물 확률">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>기본 성공 확률</span>
                    <span>{formatPercent(result.synthesis.baseSuccessChancePercent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>[손재주] 성공률 보정</span>
                    <span>{formatPercent(result.synthesis.dexteritySuccessBonusPercent)}</span>
                  </div>
                  <div className="border-t border-gray-800/20 my-2" />
                  <div className="flex justify-between">
                    <span>최종 성공 확률</span>
                    <span>{formatPercent(result.synthesis.finalSuccessChancePercent)}</span>
                  </div>
                </div>
              </ResultCard>

              <ResultCard title="수익 계산">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>1회 제작 재료 원가</span>
                    <span>{formatCell(result.ingredientCostPerCraft)}셀</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1회 제작 기대 매출</span>
                    <span>{formatCell(result.synthesis.expectedRevenuePerCraft)}셀</span>
                  </div>

                  <div
                    className={`mt-3 rounded-xl px-4 py-3 ${
                      isNegativeProfit
                        ? "border border-red-200 bg-red-50"
                        : "border border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-semibold ${
                          isNegativeProfit ? "text-red-900" : "text-blue-900"
                        }`}
                      >
                        1회 제작 기대 순이익
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          isNegativeProfit ? "text-red-700" : "text-blue-700"
                        }`}
                      >
                        {formatCell(result.synthesis.expectedNetProfitPerCraft)}셀
                      </span>
                    </div>
                  </div>
                </div>
              </ResultCard>
            </>
          )}
        </CalculatorPanel>
      }
    />
  );
}