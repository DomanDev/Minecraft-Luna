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
import {
  formatCell,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatPercentFromRatio,
} from "@/src/lib/format";
import { toast } from "sonner";
import { loadUserMarketPrices, upsertUserMarketPrices } from "@/src/lib/market/db";
import type { MarketGrade, UserMarketPriceRow, MarketCategory } from "@/src/lib/market/types";
import {
  FARMING_MARKET_ITEMS,
  FISHING_MARKET_ITEMS,
  COOKING_MARKET_ITEMS,
} from "@/src/lib/market/defaultPrices";

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

function formatSeconds(value: number | null, digits = 1): string {
  if (value == null) return "-";
  return `${formatDecimal(value, digits)}초`;
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

/**
 * 요리 재료 ID가 어느 시세 카테고리를 참조해야 하는지 반환
 *
 * 정책:
 * - 농작물 재료 -> farming
 * - 물고기/수산 재료 -> fishing
 *
 * 주의:
 * - 이 함수는 "재료 원가 계산용 자동 불러오기"에만 사용한다.
 * - 요리 결과물 시세(일반/일품)는 별도로 cooking 카테고리를 사용한다.
 */
function getIngredientMarketCategory(
  ingredientId: string,
): MarketCategory | null {
  const farmingIngredientIds = new Set([
    "lettuce",
    "corn",
    "cabbage",
    "radish",
    "tomato",
    "strawberry",
    "grape",
    "lemon",
    "orange",
    "pineapple",
    "banana",
    "pomegranate",
  ]);

  const fishingIngredientIds = new Set([
    "miscFish",
    "sardine",
    "catfish",
    "carp",
    "redSnapper",
    "anglerfish",
    "tuna",
    "lobster",
    "seaBass",
    "mullet",
    "blueTang",
    "clownfish",
    "sunfish",
    "stripedSeabream",
    "swampFrog",
    "mantaRay",
    "octopus",
    "salmon",
    "sturgeon",
    "pike",
    "goldfish",
    "blueJellyfish",
    "eel",
    "pufferfish",
  ]);

  if (farmingIngredientIds.has(ingredientId)) {
    return "farming";
  }

  if (fishingIngredientIds.has(ingredientId)) {
    return "fishing";
  }

  return null;
}

/**
 * 농사/낚시 시세 테이블의 3등급 가격 중
 * 요리 재료 단가로 어떤 값을 가져올지 결정한다.
 *
 * 현재 정책:
 * - 일반(normal) 시세를 기본 재료 단가로 사용
 *
 * 이유:
 * - 요리 재료 입력은 "개당 가격" 1개만 받고 있고
 * - 현재 요리 레시피 재료는 일반/고급/희귀를 따로 분기하지 않는다.
 */
function pickBaseIngredientPrice(rows: UserMarketPriceRow[], itemKey: string): number | null {
  const normalRow = rows.find(
    (row) => row.item_key === itemKey && row.grade === "normal",
  );

  if (normalRow && typeof normalRow.price === "number") {
    return normalRow.price;
  }

  return null;
}

/**
 * defaultPrices.ts 에 정의된 하드코딩 기본 시세에서
 * 특정 카테고리 + itemKey + grade 조합의 가격을 찾는다.
 *
 * 왜 필요한가?
 * - 현재 요리 재료 자동 불러오기는 user_market_prices만 읽고 있어서
 *   사용자가 농사/낚시 시세를 아직 저장하지 않았다면 0으로 남을 수 있다.
 * - 하지만 시세 탭에는 이미 하드코딩 기본값이 있으므로,
 *   DB 저장값이 없을 때는 그 기본값을 fallback으로 사용해야 한다.
 */
function pickDefaultMarketPrice(
  category: MarketCategory,
  itemKey: string,
  grade: MarketGrade,
): number | null {
  const source =
    category === "farming"
      ? FARMING_MARKET_ITEMS
      : category === "fishing"
      ? FISHING_MARKET_ITEMS
      : category === "cooking"
      ? COOKING_MARKET_ITEMS
      : [];

  const matchedItem = source.find((item) => item.key === itemKey);

  if (!matchedItem) {
    return null;
  }

  const value = matchedItem.prices[grade];

  return typeof value === "number" ? value : null;
}

/**
 * 농사/낚시 재료 단가를 결정한다.
 *
 * 우선순위:
 * 1) user_market_prices 저장값(normal)
 * 2) defaultPrices.ts의 하드코딩 기본값(normal)
 * 3) 없으면 null
 *
 * 현재 정책:
 * - 요리 재료 단가는 일반(normal) 시세를 사용
 */
function resolveIngredientBasePrice(
  category: Extract<MarketCategory, "farming" | "fishing">,
  rows: UserMarketPriceRow[],
  itemKey: string,
): number | null {
  const saved = pickBaseIngredientPrice(rows, itemKey);

  if (typeof saved === "number") {
    return saved;
  }

  return pickDefaultMarketPrice(category, itemKey, "normal");
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
  /**
   * 현재 선택 레시피 기준 시세를 user_market_prices 에서 자동으로 불러오는 중인지 여부
   *
   * 왜 필요한가?
   * - recipeId 변경
   * - 최초 프로필 로드 완료
   * - auth state 변화
   * 시점이 겹치면 동일한 조회가 짧은 시간에 중복될 수 있기 때문이다.
   */
  const loadingMarketPriceRef = useRef(false);

  /**
   * 자동 시세 반영 이력이 있는지 추적
   *
   * 목적:
   * - 디버깅 시 "초기값인지 / 저장값이 반영된 상태인지" 구분하기 쉽게 함
   * - 필수는 아니지만 상태 추적에 유용하다.
   */
  const hasAppliedMarketPriceRef = useRef(false);


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

  /**
   * 현재 선택 레시피의 시세를 불러와
   * 요리 계산기 입력 상태에 반영한다.
   *
   * 최종 정책:
   * 1) 재료 단가
   *    - farming / fishing user_market_prices 저장값 우선
   *    - 없으면 defaultPrices.ts 하드코딩 기본값 사용
   *    - 그리고 현재 레시피에 대해 cooking 카테고리에 저장한
   *      ingredient override 값이 있으면 최종 우선 적용
   *
   * 2) 결과물 시세
   *    - cooking user_market_prices 저장값 우선
   *    - 없으면 defaultPrices.ts의 요리 결과물 기본값 사용
   *
   * 즉 우선순위는:
   * - 재료: cooking override > farming/fishing saved > farming/fishing default
   * - 결과물: cooking saved > cooking default
   */
  const applySavedMarketPriceToCalculator = useCallback(
    async (targetRecipeId: CookingRecipeId) => {
      if (loadingMarketPriceRef.current) return;
      if (guardLoading) return;
      if (!allowed) return;

      loadingMarketPriceRef.current = true;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn("요리 시세용 getSession 실패:", sessionError.message);
          return;
        }

        const user = session?.user;
        if (!user) return;

        /**
         * 재료 기본 시세 출처:
         * - farming
         * - fishing
         *
         * 재료 override / 결과물 시세 출처:
         * - cooking
         */
        const [farmingRows, fishingRows, cookingRows] = await Promise.all([
          loadUserMarketPrices(user.id, "farming"),
          loadUserMarketPrices(user.id, "fishing"),
          loadUserMarketPrices(user.id, "cooking"),
        ]);

        const targetRecipe = getCookingRecipe(targetRecipeId);

        /**
         * 현재 레시피에 필요한 재료 키만 유지하는 초기 상태를 만든다.
         * 이후 아래 단계에서 순차적으로 덮어쓴다.
         */
        const nextIngredientUnitPrices = syncIngredientPrices(
          targetRecipeId,
          ingredientUnitPrices,
        );

        targetRecipe.ingredients.forEach((ingredient) => {
          const category = getIngredientMarketCategory(ingredient.id);

          /**
           * 1단계: farming / fishing 저장값 또는 기본값 반영
           */
          if (category === "farming") {
            const resolved = resolveIngredientBasePrice(
              "farming",
              farmingRows,
              ingredient.id,
            );

            if (typeof resolved === "number") {
              nextIngredientUnitPrices[ingredient.id] = resolved;
            }
          }

          if (category === "fishing") {
            const resolved = resolveIngredientBasePrice(
              "fishing",
              fishingRows,
              ingredient.id,
            );

            if (typeof resolved === "number") {
              nextIngredientUnitPrices[ingredient.id] = resolved;
            }
          }

          /**
           * 2단계: 현재 레시피 기준 cooking override 재료 시세가 있으면 최우선 적용
           *
           * 저장 키 예시:
           * - ingredient:ssambap:lettuce
           * - ingredient:ssambap:miscFish
           */
          const savedIngredientOverride = cookingRows.find(
            (row) =>
              row.item_key === `ingredient:${targetRecipeId}:${ingredient.id}` &&
              row.grade === "single",
          )?.price;

          if (typeof savedIngredientOverride === "number") {
            nextIngredientUnitPrices[ingredient.id] = savedIngredientOverride;
          }
        });

        /**
         * 결과물 시세:
         * - cooking 저장값 우선
         * - 없으면 defaultPrices.ts 기본값 fallback
         */
        const savedNormalDishPrice = cookingRows.find(
          (row) =>
            row.item_key === `result:${targetRecipeId}:normal` &&
            row.grade === "normal_result",
        )?.price;

        const savedSpecialDishPrice = cookingRows.find(
          (row) =>
            row.item_key === `result:${targetRecipeId}:special` &&
            row.grade === "special_result",
        )?.price;

        const defaultNormalDishPrice = pickDefaultMarketPrice(
          "cooking",
          targetRecipeId,
          "normal_result",
        );

        const defaultSpecialDishPrice = pickDefaultMarketPrice(
          "cooking",
          targetRecipeId,
          "special_result",
        );

        setIngredientUnitPrices(nextIngredientUnitPrices);

        if (typeof savedNormalDishPrice === "number") {
          setNormalDishPrice(savedNormalDishPrice);
        } else if (typeof defaultNormalDishPrice === "number") {
          setNormalDishPrice(defaultNormalDishPrice);
        }

        if (typeof savedSpecialDishPrice === "number") {
          setSpecialDishPrice(savedSpecialDishPrice);
        } else if (typeof defaultSpecialDishPrice === "number") {
          setSpecialDishPrice(defaultSpecialDishPrice);
        }

        setIsDirty(true);
        hasAppliedMarketPriceRef.current = true;
      } catch (error) {
        console.error("현재 레시피 저장 시세 자동 불러오기 실패:", error);
      } finally {
        loadingMarketPriceRef.current = false;
      }
    },
    [allowed, guardLoading, ingredientUnitPrices],
  );

  /**
   * 현재 선택 레시피의 재료 시세 + 결과물 시세를 user_market_prices 에 저장한다.
   *
   * 저장 정책:
   * 1) 재료 단가:
   *    - ingredient:{recipeId}:{ingredientId}
   *    - grade = single
   *
   * 2) 결과물 시세:
   *    - result:{recipeId}:normal
   *    - result:{recipeId}:special
   *
   * 이렇게 저장해 두면,
   * 다음에 같은 레시피를 열었을 때
   * farming/fishing 기본값보다 이 레시피 전용 override 값이 우선 적용된다.
   */
  const handleSaveCurrentRecipePrice = useCallback(async () => {
    if (!isProUser) {
      toast.error("시세 저장은 Pro 사용자만 가능합니다.");
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn("요리 시세 저장용 getSession 실패:", sessionError.message);
        toast.error("로그인 정보를 확인하지 못했습니다.");
        return;
      }

      const user = session?.user;

      if (!user) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      const rows: UserMarketPriceRow[] = [];

      /**
       * 1) 현재 레시피 재료 단가 저장
       */
      selectedRecipe.ingredients.forEach((ingredient) => {
        rows.push({
          user_id: user.id,
          category: "cooking",
          item_key: `ingredient:${recipeId}:${ingredient.id}`,
          grade: "single" as MarketGrade,
          price: ingredientUnitPrices[ingredient.id] ?? 0,
        });
      });

      /**
       * 2) 현재 레시피 결과물 시세 저장
       */
      rows.push({
        user_id: user.id,
        category: "cooking",
        item_key: `result:${recipeId}:normal`,
        grade: "normal_result" as MarketGrade,
        price: normalDishPrice,
      });

      rows.push({
        user_id: user.id,
        category: "cooking",
        item_key: `result:${recipeId}:special`,
        grade: "special_result" as MarketGrade,
        price: specialDishPrice,
      });

      await upsertUserMarketPrices(rows);

      toast.success("현재 레시피 재료/결과물 시세를 저장했습니다.");
    } catch (error) {
      console.error("현재 레시피 재료/결과물 시세 저장 실패:", error);
      toast.error("시세 저장 중 오류가 발생했습니다.");
    }
  }, [
    isProUser,
    selectedRecipe.ingredients,
    recipeId,
    ingredientUnitPrices,
    normalDishPrice,
    specialDishPrice,
  ]);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.warn("요리 시세 저장용 getSession 실패:", sessionError.message);
        toast.error("로그인 정보를 확인하지 못했습니다.");
        return;
      }

      const user = session?.user;

      if (!user) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }

      const rows: UserMarketPriceRow[] = [];

      /**
       * 1) 현재 레시피 재료 단가 저장
       *
       * 저장 키 예시:
       * - ingredient:ssambap:lettuce
       * - ingredient:ssambap:corn
       * - ingredient:ssambap:miscFish
       */
      selectedRecipe.ingredients.forEach((ingredient) => {
        rows.push({
          user_id: user.id,
          category: "cooking",
          item_key: `ingredient:${recipeId}:${ingredient.id}`,
          grade: "single" as MarketGrade,
          price: ingredientUnitPrices[ingredient.id] ?? 0,
        });
      });

      /**
       * 2) 현재 레시피 결과물 시세 저장
       */
      rows.push({
        user_id: user.id,
        category: "cooking",
        item_key: `result:${recipeId}:normal`,
        grade: "normal_result" as MarketGrade,
        price: normalDishPrice,
      });

      rows.push({
        user_id: user.id,
        category: "cooking",
        item_key: `result:${recipeId}:special`,
        grade: "special_result" as MarketGrade,
        price: specialDishPrice,
      });

      await upsertUserMarketPrices(rows);

      toast.success("현재 레시피 재료/결과물 시세를 저장했습니다.");
    } catch (error) {
      console.error("현재 레시피 재료/결과물 시세 저장 실패:", error);
      toast.error("시세 저장 중 오류가 발생했습니다.");
    }
  }, [
    isProUser,
    selectedRecipe.ingredients,
    recipeId,
    ingredientUnitPrices,
    normalDishPrice,
    specialDishPrice,
  ]);

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

  /**
   * 현재 선택 레시피의 시세를 자동 반영한다.
   *
   * 중요 변경:
   * - 이전에는 profileLoaded 가 true 여야만 실행됐는데,
   *   이 경우 cooking_profiles 로드가 끝나지 않으면
   *   재료/결과물 시세 자동 반영까지 같이 막히는 문제가 있었다.
   *
   * - 하지만 시세 자동 로딩은
   *   cooking_profiles 성공 여부와 직접 관계가 없다.
   *   로그인 + 접근 허용만 되면 getSession 기반으로 읽을 수 있다.
   *
   * 따라서 profileLoaded 의존성을 제거한다.
   */
  useEffect(() => {
    if (guardLoading) return;
    if (!allowed) return;

    void applySavedMarketPriceToCalculator(recipeId);
  }, [
    guardLoading,
    allowed,
    recipeId,
    applySavedMarketPriceToCalculator,
  ]);

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
    /**
     * 자동 시세 반영 추적 상태도 초기화
     *
     * 이유:
     * - 전체 초기화 후 다시 레시피 선택 / 자동 로드 흐름을 자연스럽게 유지하기 위함
     */
    hasAppliedMarketPriceRef.current = false;
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
                    const nextRecipeId = value as CookingRecipeId;

                    /**
                     * 현재 선택 레시피를 먼저 바꾸고,
                     * 이어서 해당 레시피의 저장 시세를 자동 불러온다.
                     *
                     * 저장값이 없는 경우:
                     * - 재료 단가 / 결과물 시세는 현재 값 유지
                     *
                     * 저장값이 있는 경우:
                     * - 현재 레시피 기준 저장된 시세로 자동 반영
                     */
                    setRecipeId(nextRecipeId);
                    setIsDirty(true);

                    void applySavedMarketPriceToCalculator(nextRecipeId);
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
          {/**
           * 현재 선택 레시피 시세 저장 버튼
           *
           * 최종 정책:
           * - 재료 단가는 농사/낚시 시세를 기본값으로 자동 불러온다.
           * - 사용자가 현재 레시피에서 재료 단가를 직접 수정한 경우,
           *   이 버튼으로 레시피별 재료 override 값을 저장할 수 있다.
           * - 결과물 시세(일반 / 일품)도 함께 저장한다.
           */}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton onClick={handleSaveCurrentRecipePrice} disabled={!isProUser}>
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
                <span>{formatInteger(result.selectedRareIngredientCount) }개</span>
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
                <span>{formatCell(result.ingredientCostPerCraft)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>1회 기대 매출</span>
                <span>{formatCell(result.expectedRevenuePerCraft)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>1회 기대 순이익</span>
                <span>{formatCell(result.expectedNetProfitPerCraft)}셀</span>
              </div>

              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    시간당 기대 순이익
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatCell(result.expectedNetProfitPerHour)}셀
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