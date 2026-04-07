'use client';

/**
 * [프로필 페이지]
 *
 * 이번 개편의 핵심:
 * 1) 기존 "생활 정보 가져오기(import)" 유지
 * 2) 직접 입력(manual)을 "공통 스탯 + 직업별 탭" 구조로 개편
 * 3) 공통 스탯 6개(total 기준) 입력
 *    - 행운, 감각, 인내력, 노련함, 손재주, 카리스마
 * 4) 직업별 탭에서
 *    - 숙련도 레벨
 *    - 스킬 레벨
 *    - 도감 효과
 *    를 분리 입력
 * 5) 저장 시 공통 스탯을 각 직업 stats로 반복 주입
 *
 * 주의:
 * - 이 파일은 src/types/life-profile.ts 쪽 타입 확장과 함께 적용해야 안전하다.
 * - save-life-profile.ts 쪽 스킬 한글명 매핑도 같이 확장해야 한다.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import {
  saveLifeProfileFromText,
  saveManualLifeProfile,
} from '../../src/lib/save-life-profile';
import type {
  ManualLifeProfileInput,
  ParsedLifeProfile,
  ParsedStatValue,
} from '../../src/types/life-profile';
import { toast } from 'sonner';
import {
  buildStoredMinecraftHeadUrl,
  getMinecraftStatusMeta,
  type MinecraftLinkStatus,
  type MinecraftLookupResult,
} from '../../src/lib/minecraft-profile';


/**
 * profiles 테이블에서 가져오는 기본 프로필 타입
 */
type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  plan_type: 'free' | 'pro';
  minecraft_uuid: string | null;
  minecraft_link_status: MinecraftLinkStatus;
  minecraft_linked_at: string | null;
  minecraft_verified_at: string | null;
};

type InputMode = 'import' | 'manual';
type ManualJobTab = 'fishing' | 'farming' | 'mining' | 'cooking';

/**
 * 공통 스탯 입력 state
 *
 * 정책:
 * - 모두 total 기준 입력
 * - 기본값 0
 * - 저장 시 필요한 직업에 반복 주입
 */
type ManualCommonStatsState = {
  reputationLevel: number;
  luck: number;
  sense: number;
  endurance: number;
  mastery: number;
  dexterity: number;
  charisma: number;
};

/**
 * 낚시 탭 state
 */
type ManualFishingState = {
  level: number;
  skills: {
    treasureDetection: number;
    famousBait: number;
    lineTension: number;
    doubleCatch: number;
    schoolFishing: number;
  };
  codex: {
    normalFishReduction: number;
    nibbleTimeReduction: number;
  };
};

/**
 * 농사 탭 state
 */
type ManualFarmingState = {
  level: number;
  skills: {
    blessingOfHarvest: number;
    fertileSoil: number;
    oathOfCultivation: number;
    handOfHarvest: number;
    reseeding: number;
  };
  codex: {
    normalCropReduction: number;
  };
};

/**
 * 채광 탭 state
 */
type ManualMiningState = {
  level: number;
  skills: {
    temperedPickaxe: number;
    veinSense: number;
    veinFlow: number;
    veinDetection: number;
    explosiveMining: number;
  };
  codex: {
    miningDelayReduction: number;
    miningDamageIncrease: number;
  };
};

/**
 * 요리 탭 state
 */
type ManualCookingState = {
  level: number;
  skills: {
    preparationMaster: number;
    balanceOfTaste: number;
    gourmet: number;
    instantCompletion: number;
    banquetPreparation: number;
  };
  codex: {
    cookingGradeUpChance: number;
  };
};

/**
 * manual 전체 state
 */
type ManualProfileState = {
  common: ManualCommonStatsState;
  fishing: ManualFishingState;
  farming: ManualFarmingState;
  mining: ManualMiningState;
  cooking: ManualCookingState;
};

/**
 * manual 기본값
 */
const INITIAL_MANUAL_PROFILE: ManualProfileState = {
  common: {
    reputationLevel: 0,
    luck: 0,
    sense: 0,
    endurance: 0,
    mastery: 0,
    dexterity: 0,
    charisma: 0,
  },
  fishing: {
    level: 0,
    skills: {
      treasureDetection: 0,
      famousBait: 0,
      lineTension: 0,
      doubleCatch: 0,
      schoolFishing: 0,
    },
    codex: {
      normalFishReduction: 0,
      nibbleTimeReduction: 0,
    },
  },
  farming: {
    level: 0,
    skills: {
      blessingOfHarvest: 0,
      fertileSoil: 0,
      oathOfCultivation: 0,
      handOfHarvest: 0,
      reseeding: 0,
    },
    codex: {
      normalCropReduction: 0,
    },
  },
  mining: {
    level: 0,
    skills: {
      temperedPickaxe: 0,
      veinSense: 0,
      veinFlow: 0,
      veinDetection: 0,
      explosiveMining: 0,
    },
    codex: {
      miningDelayReduction: 0,
      miningDamageIncrease: 0,
    },
  },
  cooking: {
    level: 0,
    skills: {
      preparationMaster: 0,
      balanceOfTaste: 0,
      gourmet: 0,
      instantCompletion: 0,
      banquetPreparation: 0,
    },
    codex: {
      cookingGradeUpChance: 0,
    },
  },
};

const FISHING_SKILL_LABELS: Record<string, string> = {
  treasureDetection: '보물 감지',
  famousBait: '소문난 미끼',
  lineTension: '낚싯줄 장력',
  doubleCatch: '쌍걸이',
  schoolFishing: '떼낚시',
};

const FARMING_SKILL_LABELS: Record<string, string> = {
  blessingOfHarvest: '풍년의 축복',
  fertileSoil: '비옥한 토양',
  oathOfCultivation: '개간의 서약',
  handOfHarvest: '수확의 손길',
  reseeding: '되뿌리기',
};

const MINING_SKILL_LABELS: Record<string, string> = {
  temperedPickaxe: '단련된 곡괭이',
  veinSense: '광맥 감각',
  veinFlow: '광맥 흐름',
  veinDetection: '광맥 탐지',
  explosiveMining: '폭발적인 채광',
};

const COOKING_SKILL_LABELS: Record<string, string> = {
  preparationMaster: '손질 달인',
  balanceOfTaste: '맛의 균형',
  gourmet: '미식가',
  instantCompletion: '즉시 완성',
  banquetPreparation: '연회 준비',
};

function toNumberValue(value: string): number {
  if (value.trim() === '') return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function formatStatValue(stat: ParsedStatValue | undefined): string {
  if (!stat) return '-';
  return `base: ${stat.base} / temp: ${stat.temp} / equip: ${stat.equip} / total: ${stat.total}`;
}
/**
 * 값이 숫자가 아니면 0으로 정리하는 작은 헬퍼
 */
function toSafeManualNumber(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

/**
 * 저장된 ParsedLifeProfile -> 직접 입력 폼 state 로 역변환
 *
 * 목적:
 * - 예전에 "직접 입력 저장"한 데이터를 다시 불러와
 *   manualForm 입력칸에 자동으로 채워 넣기 위함
 */
function buildManualFormFromParsed(
  parsed: ParsedLifeProfile,
): ManualProfileState {
  const fishingJob = parsed.jobs?.fishing;
  const farmingJob = parsed.jobs?.farming;
  const miningJob = parsed.jobs?.mining;
  const cookingJob = parsed.jobs?.cooking;

  const fishingSkills = parsed.skills?.fishing ?? {};
  const farmingSkills = parsed.skills?.farming ?? {};
  const miningSkills = parsed.skills?.mining ?? {};
  const cookingSkills = parsed.skills?.cooking ?? {};

  /**
   * 공통 스탯은 현재 저장 구조상 각 직업 stats에 반복 저장되므로
   * 우선순위를 정해서 하나를 기준으로 꺼내온다.
   *
   * - luck / sense / endurance 는 fishing 기준 우선
   * - mastery / dexterity 는 cooking 기준 우선
   * - 없으면 farming / mining 쪽에서 보조적으로 확인
   */
  const commonStatsSource =
    fishingJob?.stats ??
    farmingJob?.stats ??
    miningJob?.stats ??
    cookingJob?.stats ??
    {};

  return {
    common: {
      reputationLevel: toSafeManualNumber(parsed.reputationLevel),
      luck: toSafeManualNumber(commonStatsSource.luck?.total),
      sense: toSafeManualNumber(commonStatsSource.sense?.total),
      endurance: toSafeManualNumber(commonStatsSource.endurance?.total),
      mastery: toSafeManualNumber(
        cookingJob?.stats?.mastery?.total ?? commonStatsSource.mastery?.total,
      ),
      dexterity: toSafeManualNumber(
        cookingJob?.stats?.dexterity?.total ?? commonStatsSource.dexterity?.total,
      ),
      charisma: toSafeManualNumber(commonStatsSource.charisma?.total),
    },

    fishing: {
      level: toSafeManualNumber(fishingJob?.level),
      skills: {
        treasureDetection: toSafeManualNumber(fishingSkills.treasureDetection),
        famousBait: toSafeManualNumber(fishingSkills.famousBait),
        lineTension: toSafeManualNumber(fishingSkills.lineTension),
        doubleCatch: toSafeManualNumber(fishingSkills.doubleCatch),
        schoolFishing: toSafeManualNumber(fishingSkills.schoolFishing),
      },
      codex: {
        normalFishReduction: toSafeManualNumber(
          fishingJob?.stats?.normalFishReduction?.total,
        ),
        nibbleTimeReduction: toSafeManualNumber(
          fishingJob?.stats?.nibbleTimeReduction?.total,
        ),
      },
    },

    farming: {
      level: toSafeManualNumber(farmingJob?.level),
      skills: {
        blessingOfHarvest: toSafeManualNumber(farmingSkills.blessingOfHarvest),
        fertileSoil: toSafeManualNumber(farmingSkills.fertileSoil),
        oathOfCultivation: toSafeManualNumber(farmingSkills.oathOfCultivation),
        handOfHarvest: toSafeManualNumber(farmingSkills.handOfHarvest),
        reseeding: toSafeManualNumber(farmingSkills.reseeding),
      },
      codex: {
        normalCropReduction: toSafeManualNumber(
          farmingJob?.stats?.normalCropReduction?.total,
        ),
      },
    },

    mining: {
      level: toSafeManualNumber(miningJob?.level),
      skills: {
        temperedPickaxe: toSafeManualNumber(miningSkills.temperedPickaxe),
        veinSense: toSafeManualNumber(miningSkills.veinSense),
        veinFlow: toSafeManualNumber(miningSkills.veinFlow),
        veinDetection: toSafeManualNumber(miningSkills.veinDetection),
        explosiveMining: toSafeManualNumber(miningSkills.explosiveMining),
      },
      codex: {
        miningDelayReduction: toSafeManualNumber(
          miningJob?.stats?.miningDelayReduction?.total,
        ),
        miningDamageIncrease: toSafeManualNumber(
          miningJob?.stats?.miningDamageIncrease?.total,
        ),
      },
    },

    cooking: {
      level: toSafeManualNumber(cookingJob?.level),
      skills: {
        preparationMaster: toSafeManualNumber(cookingSkills.preparationMaster),
        balanceOfTaste: toSafeManualNumber(cookingSkills.balanceOfTaste),
        gourmet: toSafeManualNumber(cookingSkills.gourmet),
        instantCompletion: toSafeManualNumber(cookingSkills.instantCompletion),
        banquetPreparation: toSafeManualNumber(cookingSkills.banquetPreparation),
      },
      codex: {
        cookingGradeUpChance: toSafeManualNumber(
          cookingJob?.stats?.cookingGradeUpChance?.total,
        ),
      },
    },
  };
}

/**
 * 공통 스탯을 각 직업에 반복 주입해
 * ManualLifeProfileInput으로 변환
 *
 * 설계 이유:
 * - 입력은 공통 스탯 1회
 * - 저장 구조는 직업별 jobs.stats
 */
function buildManualLifeProfileInput(
  form: ManualProfileState,
): ManualLifeProfileInput {
  return {
    reputationLevel: form.common.reputationLevel,
    jobs: {
      fishing: {
        level: form.fishing.level,
        stats: {
          luck: { total: form.common.luck },
          sense: { total: form.common.sense },
          endurance: { total: form.common.endurance },
          mastery: { total: form.common.mastery },
          dexterity: { total: form.common.dexterity },
          charisma: { total: form.common.charisma },

          /**
           * 도감 효과는 UI에서는 분리 입력하지만
           * 저장은 계산기에 쓰기 쉽도록 stats에 둔다.
           */
          normalFishReduction: { total: form.fishing.codex.normalFishReduction },
          nibbleTimeReduction: { total: form.fishing.codex.nibbleTimeReduction },
        },
      },
      farming: {
        level: form.farming.level,
        stats: {
          luck: { total: form.common.luck },
          sense: { total: form.common.sense },
          endurance: { total: form.common.endurance },
          mastery: { total: form.common.mastery },
          dexterity: { total: form.common.dexterity },
          charisma: { total: form.common.charisma },
          normalCropReduction: { total: form.farming.codex.normalCropReduction },
        },
      },
      mining: {
        level: form.mining.level,
        stats: {
          luck: { total: form.common.luck },
          sense: { total: form.common.sense },
          endurance: { total: form.common.endurance },
          mastery: { total: form.common.mastery },
          dexterity: { total: form.common.dexterity },
          charisma: { total: form.common.charisma },
          miningDelayReduction: { total: form.mining.codex.miningDelayReduction },
          miningDamageIncrease: { total: form.mining.codex.miningDamageIncrease },
        },
      },
      cooking: {
        level: form.cooking.level,
        stats: {
          luck: { total: form.common.luck },
          sense: { total: form.common.sense },
          endurance: { total: form.common.endurance },
          mastery: { total: form.common.mastery },
          dexterity: { total: form.common.dexterity },
          charisma: { total: form.common.charisma },
          cookingGradeUpChance: { total: form.cooking.codex.cookingGradeUpChance },
        },
      },
    },
    skills: {
      fishing: {
        treasureDetection: form.fishing.skills.treasureDetection,
        famousBait: form.fishing.skills.famousBait,
        lineTension: form.fishing.skills.lineTension,
        doubleCatch: form.fishing.skills.doubleCatch,
        schoolFishing: form.fishing.skills.schoolFishing,
      },
      farming: {
        blessingOfHarvest: form.farming.skills.blessingOfHarvest,
        fertileSoil: form.farming.skills.fertileSoil,
        oathOfCultivation: form.farming.skills.oathOfCultivation,
        handOfHarvest: form.farming.skills.handOfHarvest,
        reseeding: form.farming.skills.reseeding,
      },
      mining: {
        temperedPickaxe: form.mining.skills.temperedPickaxe,
        veinSense: form.mining.skills.veinSense,
        veinFlow: form.mining.skills.veinFlow,
        veinDetection: form.mining.skills.veinDetection,
        explosiveMining: form.mining.skills.explosiveMining,
      },
      cooking: {
        preparationMaster: form.cooking.skills.preparationMaster,
        balanceOfTaste: form.cooking.skills.balanceOfTaste,
        gourmet: form.cooking.skills.gourmet,
        instantCompletion: form.cooking.skills.instantCompletion,
        banquetPreparation: form.cooking.skills.banquetPreparation,
      },
    },
  };
}

/**
 * 직업 탭 버튼 공통 클래스 헬퍼
 */
function tabClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white'
    : 'rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50';
}

/**
 * 프로필 페이지 전용:
 * 소수 2자리까지 허용하는 입력 컴포넌트
 *
 * 정책:
 * - 천 단위 콤마 표시 안 함
 * - 입력 중 반올림 안 함
 * - 소수 둘째 자리까지만 허용
 * - 빈 문자열은 입력 중간 상태로 허용
 */
function DecimalPlainInput(props: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled = false } = props;

  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={inputValue}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        /**
         * 허용 형식:
         * - ""
         * - "12"
         * - "12."
         * - "12.3"
         * - "12.34"
         *
         * 불허:
         * - 음수
         * - 소수 셋째 자리 이상
         * - 문자
         * - 콤마
         */
        if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
          return;
        }

        setInputValue(raw);

        /**
         * 입력 중간 상태("", "12.")는 number 변환을 강제하지 않음
         */
        if (raw === "" || raw.endsWith(".")) {
          return;
        }

        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      onBlur={() => {
        /**
         * blur 시에도 반올림/콤마 처리 없이
         * 현재 입력값 그대로 정리
         */
        if (inputValue === "") {
          setInputValue("0");
          onChange(0);
          return;
        }

        if (inputValue.endsWith(".")) {
          const normalized = inputValue.slice(0, -1);
          const parsed = Number(normalized === "" ? "0" : normalized);
          setInputValue(String(parsed));
          onChange(parsed);
          return;
        }

        const parsed = Number(inputValue);
        if (Number.isNaN(parsed) || parsed < 0) {
          setInputValue("0");
          onChange(0);
          return;
        }

        setInputValue(inputValue);
        onChange(parsed);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}

/**
 * 프로필 페이지 전용:
 * 0 이상의 정수만 허용하는 입력 컴포넌트
 *
 * 정책:
 * - 천 단위 콤마 표시 안 함
 * - 소수 입력 불가
 * - 음수 입력 불가
 */
function PositiveIntegerPlainInput(props: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled = false } = props;

  const [inputValue, setInputValue] = useState(String(Math.max(0, Math.trunc(value))));

  useEffect(() => {
    setInputValue(String(Math.max(0, Math.trunc(value))));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={inputValue}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        /**
         * 숫자만 허용
         */
        if (!/^\d*$/.test(raw)) {
          return;
        }

        setInputValue(raw);

        if (raw === "") {
          return;
        }

        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      onBlur={() => {
        if (inputValue === "") {
          setInputValue("0");
          onChange(0);
          return;
        }

        const parsed = Number(inputValue);
        if (Number.isNaN(parsed) || parsed < 0) {
          setInputValue("0");
          onChange(0);
          return;
        }

        const normalized = Math.trunc(parsed);
        setInputValue(String(normalized));
        onChange(normalized);
      }}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-500"
    />
  );
}
/**
 * 소수 2자리 허용 필드
 * - 공통 스탯
 * - 도감 효과
 */
function DecimalField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
}) {
  const { label, value, onChange, help } = props;

  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <DecimalPlainInput value={value} onChange={onChange} />

      {help && <p className="text-xs text-gray-500">{help}</p>}
    </label>
  );
}

/**
 * 양의 정수 전용 필드
 * - 명성 레벨
 * - 직업 레벨
 * - 스킬 레벨
 */
function IntegerField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
}) {
  const { label, value, onChange, help } = props;

  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      <PositiveIntegerPlainInput value={value} onChange={onChange} />

      {help && <p className="text-xs text-gray-500">{help}</p>}
    </label>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  /**
   * 기본 프로필 수정용 state
   *
   * 정책 정리:
   * - username:
   *   마인크래프트 닉네임이 저장되는 기본 유저명
   *   -> 직접 수정 대상이 아니라 "조회/연동"으로 갱신
   * - display_name:
   *   Pro 유저만 수정 가능한 한글 표시명
   *   -> 있으면 사이트 표시 우선순위가 더 높음
   */
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState('');

  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [manualJobTab, setManualJobTab] = useState<ManualJobTab>('fishing');

  const [rawText, setRawText] = useState('');
  const [manualForm, setManualForm] =
    useState<ManualProfileState>(INITIAL_MANUAL_PROFILE);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [manualLoadLoading, setManualLoadLoading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ParsedLifeProfile | null>(null);

  /**
   * 마인크래프트 프로필 연동 관련 state
   *
   * 중요:
   * - 이 state들은 반드시 컴포넌트 내부에 있어야 한다.
   * - 이전 버전처럼 컴포넌트 바깥에 두면 React hook 규칙 위반으로 컴파일이 깨진다.
   */
  const [minecraftNicknameInput, setMinecraftNicknameInput] = useState('');
  const [minecraftLookupLoading, setMinecraftLookupLoading] = useState(false);
  const [minecraftLookupError, setMinecraftLookupError] = useState('');
  const [minecraftPreview, setMinecraftPreview] =
    useState<MinecraftLookupResult | null>(null);
  const [minecraftModalOpen, setMinecraftModalOpen] = useState(false);
  const [minecraftLinkSaving, setMinecraftLinkSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);

      /**
       * 1차 조회:
       * - 기존 profiles row가 있는지 확인
       */
      let { data, error } = await supabase
        .from('profiles')
        .select(
          'id, username, display_name, plan_type, minecraft_uuid, minecraft_link_status, minecraft_linked_at, minecraft_verified_at',
        )
        .eq('id', user.id)
        .maybeSingle();

      /**
       * row가 없는 경우:
       * - 첫 Discord 로그인 사용자일 수 있으므로
       *   free 플랜 기본값으로 profiles를 즉시 생성
       *
       * 참고:
       * - 원칙적으로는 DB trigger가 가장 안정적이다.
       * - 하지만 개발 중 trigger가 아직 적용 안 되었을 수 있으므로
       *   프론트에서도 1회 보정 로직을 둔다.
       */
      if (!data) {
        const insertPayload = {
          id: user.id,
          username: null,
          display_name: null,
          plan_type: 'free' as const,
          minecraft_uuid: null,
          minecraft_link_status: 'needs_lookup' as const,
          minecraft_linked_at: null,
          minecraft_verified_at: null,
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .upsert(insertPayload, { onConflict: 'id' });

        if (insertError) {
          console.error(
            '기본 profiles 생성 실패:',
            JSON.stringify(insertError, null, 2),
          );
          console.error('기본 profiles 생성 실패 raw: ', insertError);
        }

        const retry = await supabase
          .from('profiles')
          .select(
            'id, username, display_name, plan_type, minecraft_uuid, minecraft_link_status, minecraft_linked_at, minecraft_verified_at',
          )
          .eq('id', user.id)
          .single();

        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('프로필 조회 실패:', JSON.stringify(error, null, 2));
        console.error('프로필 조회 실패:', error);
        setProfile(null);
      } else {
        setProfile(data);
        setEditUsername(data?.username ?? '');
        setEditDisplayName(data?.display_name ?? '');
        setMinecraftNicknameInput(data?.username ?? '');
      }

      setProfileLoading(false);
    };

    void fetchProfile();
  }, [user]);

  /**
   * 공통 스탯 업데이트
   */
  const updateCommonStat = <K extends keyof ManualCommonStatsState>(
    key: K,
    value: ManualCommonStatsState[K],
  ) => {
    setManualForm((prev) => ({
      ...prev,
      common: {
        ...prev.common,
        [key]: value,
      },
    }));
  };

  /**
   * 직업 레벨 업데이트
   */
  const updateJobLevel = (job: ManualJobTab, value: number) => {
    setManualForm((prev) => ({
      ...prev,
      [job]: {
        ...prev[job],
        level: value,
      },
    }));
  };

  /**
   * 직업 스킬 업데이트
   */
  const updateJobSkill = <
    J extends ManualJobTab,
    K extends keyof ManualProfileState[J]['skills']
  >(
    job: J,
    key: K,
    value: number,
  ) => {
    setManualForm((prev) => ({
      ...prev,
      [job]: {
        ...prev[job],
        skills: {
          ...prev[job].skills,
          [key]: value,
        },
      },
    }));
  };

  /**
   * 직업 도감 효과 업데이트
   */
  const updateJobCodex = <
    J extends ManualJobTab,
    K extends keyof ManualProfileState[J]['codex']
  >(
    job: J,
    key: K,
    value: number,
  ) => {
    setManualForm((prev) => ({
      ...prev,
      [job]: {
        ...prev[job],
        codex: {
          ...prev[job].codex,
          [key]: value,
        },
      },
    }));
  };

  /**
   * 상태 배지는 요약 카드 / 연동 섹션 / 헤더에서 동일한 의미를 쓰도록
   * helper 결과를 한 번만 계산해서 재사용한다.
   */
  const minecraftStatusMeta = getMinecraftStatusMeta(
    profile?.minecraft_link_status ?? 'needs_lookup',
  );

  /**
   * 생활 정보 등록 가능 여부
   *
   * 기준:
   * - username 존재
   * - minecraft_uuid 존재
   * - 상태가 조회 필요(needs_lookup)가 아님
   *
   * 즉, 최소한 마인크래프트 프로필 연동을 완료한 사용자만
   * 생활 정보 등록을 허용한다.
   */
  const isMinecraftLinked =
    Boolean(profile?.username) &&
    Boolean(profile?.minecraft_uuid) &&
    profile?.minecraft_link_status !== 'needs_lookup';

  /**
   * UUID가 있을 때 실제 표시용 머리 이미지 URL 생성
   *
   * 정책:
   * - 프로필/모달/헤더에서 사용할 최종 이미지는 "작은 머리 이미지"로 통일
   * - 큰 아바타/바디 렌더는 제거
   * - 조회 응답에 avatarUrl이 오더라도,
   *   이미 저장된 프로필 표시에는 UUID 기반 동일 규칙을 사용한다.
   */
  const linkedMinecraftHeadUrl = buildStoredMinecraftHeadUrl({
    username: profile?.username,
    uuid: profile?.minecraft_uuid,
    size: 64,
  });
  /**
   * 기본 프로필 저장
   *
   * 정책(최종):
   * - 유저명(username):
   *   마인크래프트 조회 후 연동된 닉네임이 저장되는 칸
   *   -> 여기서는 직접 수정하지 않음
   * - 표시명(display_name):
   *   Pro 유저만 수정 가능한 한글/별칭 표시명
   *   -> 값이 있으면 사이트 표시 우선순위가 더 높음
   */
  const handleSaveBasicProfile = async () => {
    try {
      setProfileSaving(true);
      setProfileSaveMessage('');

      if (!user || !profile) {
        setProfileSaveMessage('사용자 정보를 불러올 수 없습니다.');
        return;
      }

      const trimmedDisplayName = editDisplayName.trim();
      const canEditDisplayName = profile.plan_type === 'pro';
      const isDisplayNameChanged =
        trimmedDisplayName !== (profile.display_name ?? '');

      if (!isDisplayNameChanged) {
        setProfileSaveMessage('변경된 내용이 없습니다.');
        return;
      }

      if (!canEditDisplayName) {
        setProfileSaveMessage('표시명 변경은 Pro 유저만 가능합니다.');
        return;
      }

      /**
       * 표시명은 한글 별칭을 주로 상정하지만,
       * 기존 정책과 호환되도록 비교적 넓은 문자셋을 허용한다.
       */
      if (trimmedDisplayName !== '') {
        const displayNameRegex = /^[가-힣a-zA-Z0-9 ._]{2,30}$/;

        if (!displayNameRegex.test(trimmedDisplayName)) {
          setProfileSaveMessage(
            '표시명은 2~30자의 한글, 영문, 숫자, 공백, 밑줄(_), 마침표(.)만 사용할 수 있습니다.',
          );
          return;
        }
      }

      const updatePayload: {
        display_name: string | null;
      } = {
        display_name: trimmedDisplayName === '' ? null : trimmedDisplayName,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (updateError) {
        console.error('기본 프로필 저장 실패:', updateError);
        setProfileSaveMessage('기본 프로필 저장 중 오류가 발생했습니다.');
        return;
      }

      const nextProfile: Profile = {
        ...profile,
        display_name: updatePayload.display_name,
      };

      setProfile(nextProfile);
      setEditDisplayName(nextProfile.display_name ?? '');
      setEditUsername(nextProfile.username ?? '');
      setProfileSaveMessage('기본 프로필이 저장되었습니다.');
    } catch (error) {
      console.error('기본 프로필 저장 중 예외:', error);
      setProfileSaveMessage('기본 프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setProfileSaving(false);
    }
  };

  const resetBasicProfileForm = () => {
    setEditDisplayName(profile?.display_name ?? '');
    setEditUsername(profile?.username ?? '');
    setProfileSaveMessage('');
  };

  /**
   * 마인크래프트 닉네임 조회
   *
   * 흐름:
   * 1) 사용자가 입력한 닉네임을 검사
   * 2) 내부 API(/api/minecraft/profile)로 조회
   * 3) UUID / 머리 이미지 미리보기를 받아옴
   * 4) 확인 모달을 열어 사용자에게 한 번 더 확인시킴
   *
   * 주의:
   * - 디버그 출력은 제거했다.
   * - 이제는 큰 아바타/스킨 미리보기가 아니라
   *   실제로 프로필/헤더에서 쓸 "머리 이미지" 위주로만 확인한다.
   */
  const handleLookupMinecraftProfile = async () => {
    try {
      setMinecraftLookupLoading(true);
      setMinecraftLookupError('');
      setMinecraftPreview(null);

      const trimmedNickname = minecraftNicknameInput.trim();

      if (trimmedNickname === '') {
        setMinecraftLookupError('마인크래프트 닉네임을 입력해주세요.');
        return;
      }

      const response = await fetch(
        `/api/minecraft/profile?nickname=${encodeURIComponent(trimmedNickname)}`,
        { cache: 'no-store' },
      );

      const data = await response.json();

      if (!response.ok) {
        setMinecraftLookupError(
          data?.error ?? '마인크래프트 프로필 조회에 실패했습니다.',
        );
        return;
      }

      setMinecraftPreview(data);
      setMinecraftModalOpen(true);
    } catch (error) {
      console.error('마인크래프트 프로필 조회 중 예외:', error);
      setMinecraftLookupError(
        '마인크래프트 프로필 조회 중 오류가 발생했습니다.',
      );
    } finally {
      setMinecraftLookupLoading(false);
    }
  };

  /**
   * 마인크래프트 연동 저장
   *
   * 정책:
   * - 조회/확인한 닉네임을 username에 저장
   * - uuid는 minecraft_uuid에 저장
   * - 상태는 linked로 변경
   * - display_name은 여기서 건드리지 않음
   *
   * 이유:
   * - username = 마인크래프트 닉네임
   * - display_name = Pro 전용 별칭
   * 구조를 유지해야 하기 때문
   */
  const handleConfirmMinecraftLink = async () => {
    try {
      if (!user) {
        toast.error('사용자 정보를 확인할 수 없습니다.');
        return;
      }

      if (!minecraftPreview) {
        toast.error('조회된 마인크래프트 프로필이 없습니다.');
        return;
      }

      setMinecraftLinkSaving(true);
      setMinecraftLookupError('');

      /**
       * 같은 username(=마인크래프트 닉네임)을
       * 다른 계정이 이미 사용 중인지 확인
       */
      const { data: existingUser, error: usernameCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', minecraftPreview.nickname)
        .neq('id', user.id)
        .maybeSingle();

      if (usernameCheckError) {
        console.error('유저명 중복 확인 실패:', usernameCheckError);
        setMinecraftLookupError('유저명 중복 확인 중 오류가 발생했습니다.');
        toast.error('유저명 중복 확인 중 오류가 발생했습니다.');
        return;
      }

      if (existingUser) {
        setMinecraftLookupError(
          '이미 다른 계정에서 사용 중인 마인크래프트 닉네임입니다.',
        );
        toast.error('이미 다른 계정에서 사용 중인 마인크래프트 닉네임입니다.');
        return;
      }

      const updatePayload = {
        id: user.id,
        username: minecraftPreview.nickname,
        minecraft_uuid: minecraftPreview.uuid,
        minecraft_link_status: 'linked' as const,
        minecraft_linked_at: new Date().toISOString(),
      };

      /**
       * update 대신 upsert를 써서
       * profiles row가 아직 없는 경우도 함께 처리한다.
       */
      const { data: updatedProfile, error: upsertError } = await supabase
        .from('profiles')
        .upsert(updatePayload, { onConflict: 'id' })
        .select(
          'id, username, display_name, plan_type, minecraft_uuid, minecraft_link_status, minecraft_linked_at, minecraft_verified_at',
        )
        .single();

      if (upsertError) {
        console.error('마인크래프트 연동 저장 실패:', upsertError);
        setMinecraftLookupError('마인크래프트 연동 저장 중 오류가 발생했습니다.');
        toast.error('마인크래프트 연동 저장 중 오류가 발생했습니다.');
        return;
      }

      setProfile(updatedProfile);
      setEditUsername(updatedProfile.username ?? '');
      setMinecraftNicknameInput(updatedProfile.username ?? '');
      setMinecraftModalOpen(false);
      setMinecraftPreview(null);

      toast.success('마인크래프트 프로필이 연동되었습니다.');
    } catch (error) {
      console.error('마인크래프트 연동 저장 중 예외:', error);
      setMinecraftLookupError('마인크래프트 연동 저장 중 오류가 발생했습니다.');
      toast.error('마인크래프트 연동 저장 중 오류가 발생했습니다.');
    } finally {
      setMinecraftLinkSaving(false);
    }
  };

  const handleSaveImportProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage('');

      if (!user) {
        const message = '사용자 정보를 불러올 수 없습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      if (!isMinecraftLinked) {
        const message =
          '마인크래프트 프로필 연동 후에만 생활 정보를 등록할 수 있습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      /**
       * 1) 생활 정보 원문을 파싱하고
       * 2) DB에 저장한 뒤
       * 3) 저장된 결과(parsed)를 preview에 반영
       */
      const parsed = await saveLifeProfileFromText(user.id, rawText);
      setParsedPreview(parsed);

      /**
       * 저장 완료 메시지
       * - 기존 화면 메시지
       * - 토스트 메시지
       * 둘 다 표시
       */
      setSaveMessage('생활 정보 가져오기 저장 완료');
      toast.success('생활 정보가 저장되었습니다.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '가져오기 저장 중 오류가 발생했습니다.';
      setSaveMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManualProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage('');

      if (!user) {
        const message = '사용자 정보를 불러올 수 없습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      if (!isMinecraftLinked) {
        const message =
          '마인크래프트 프로필 연동 후에만 생활 정보를 등록할 수 있습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      /**
       * manual 입력값을 표준 구조로 변환해서 저장
       */
      const manualInput = buildManualLifeProfileInput(manualForm);
      const parsed = await saveManualLifeProfile(user.id, manualInput);
      setParsedPreview(parsed);

      setSaveMessage('직접 입력 프로필 저장 완료');
      toast.success('프로필이 저장되었습니다.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '직접 입력 저장 중 오류가 발생했습니다.';
      setSaveMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadLastManualProfile = async () => {
    try {
      setManualLoadLoading(true);
      setSaveMessage('');

      if (!user) {
        const message = '사용자 정보를 불러올 수 없습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      /**
       * 직접 입력으로 저장했던 가장 최근 스냅샷 1개 조회
       *
       * 저장 구조 근거:
       * - saveManualLifeProfile() -> saveParsedLifeProfile(...)
       * - life_profile_imports 에 input_method = "manual" 로 저장됨
       */
      const { data, error } = await supabase
        .from('life_profile_imports')
        .select('parsed_json, created_at')
        .eq('user_id', user.id)
        .eq('input_method', 'manual')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`이전 직접 입력 데이터 조회 실패: ${error.message}`);
      }

      const parsed = (data?.parsed_json ?? null) as ParsedLifeProfile | null;

      if (!parsed) {
        const message = '이전에 직접 입력하여 저장한 데이터가 없습니다.';
        setSaveMessage(message);
        toast.error(message);
        return;
      }

      const loadedForm = buildManualFormFromParsed(parsed);

      setManualForm(loadedForm);
      setParsedPreview(parsed);
      setManualJobTab('fishing');

      const message = '이전에 직접 입력한 데이터를 불러왔습니다.';
      setSaveMessage(message);
      toast.success(message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '이전 직접 입력 데이터를 불러오는 중 오류가 발생했습니다.';
      setSaveMessage(message);
      toast.error(message);
    } finally {
      setManualLoadLoading(false);
    }
  };

  const resetImportState = () => {
    setRawText('');
    setParsedPreview(null);
    setSaveMessage('');
  };

  const resetManualState = () => {
    setManualForm(INITIAL_MANUAL_PROFILE);
    setParsedPreview(null);
    setSaveMessage('');
    setManualJobTab('fishing');
  };

  const previewFishingJob = parsedPreview?.jobs?.fishing;
  const previewFarmingJob = parsedPreview?.jobs?.farming;
  const previewMiningJob = parsedPreview?.jobs?.mining;
  const previewCookingJob = parsedPreview?.jobs?.cooking;

  const previewFishingSkills = useMemo(() => {
    const fishingSkills = parsedPreview?.skills?.fishing ?? {};
    return Object.entries(FISHING_SKILL_LABELS)
      .filter(([key]) => fishingSkills[key] != null)
      .map(([key, label]) => ({ key, label, level: fishingSkills[key] }));
  }, [parsedPreview]);

  const previewFarmingSkills = useMemo(() => {
    const farmingSkills = parsedPreview?.skills?.farming ?? {};
    return Object.entries(FARMING_SKILL_LABELS)
      .filter(([key]) => farmingSkills[key] != null)
      .map(([key, label]) => ({ key, label, level: farmingSkills[key] }));
  }, [parsedPreview]);

  const previewMiningSkills = useMemo(() => {
    const miningSkills = parsedPreview?.skills?.mining ?? {};
    return Object.entries(MINING_SKILL_LABELS)
      .filter(([key]) => miningSkills[key] != null)
      .map(([key, label]) => ({ key, label, level: miningSkills[key] }));
  }, [parsedPreview]);

  const previewCookingSkills = useMemo(() => {
    const cookingSkills = parsedPreview?.skills?.cooking ?? {};
    return Object.entries(COOKING_SKILL_LABELS)
      .filter(([key]) => cookingSkills[key] != null)
      .map(([key, label]) => ({ key, label, level: cookingSkills[key] }));
  }, [parsedPreview]);

  if (loading) {
    return <div className="p-6">로그인 확인 중...</div>;
  }

  if (!user) {
    return <div className="p-6">로그인이 필요합니다.</div>;
  }

  if (profileLoading) {
    return <div className="p-6">프로필 불러오는 중...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">프로필</h1>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">이메일</div>
            <div className="font-medium">{user.email}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">유저명</div>
            <div className="mt-2 flex items-center gap-3">
              {linkedMinecraftHeadUrl ? (
                <img
                  src={linkedMinecraftHeadUrl}
                  alt="마인크래프트 머리"
                  className="h-12 w-12 rounded-lg border object-cover"
                  onError={(e) => {
                    /**
                     * 저장 후 표시용 이미지는 머리 이미지 하나만 쓴다.
                     * 로드 실패 시 이미지를 숨기고 기본 박스가 아닌 빈 상태로 처리한다.
                     */
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-gray-100 text-xs text-gray-500">
                  없음
                </div>
              )}

              <div>
                <div className="font-medium">{profile?.username ?? '-'}</div>
                <div className="mt-1">
                  <span className={minecraftStatusMeta.className}>
                    {minecraftStatusMeta.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">표시명</div>
            <div className="font-medium">{profile?.display_name ?? '-'}</div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-gray-500">플랜</div>
            <div className="font-medium uppercase">{profile?.plan_type ?? '-'}</div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <h2 className="text-lg font-semibold">기본 프로필 수정</h2>
            <p className="mt-1 text-sm text-gray-600">
              유저명은 마인크래프트 조회 후 연동된 닉네임이 저장되며, 표시명은 Pro 유저만
              수정할 수 있는 별칭입니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>표시명</span>
                {profile?.plan_type === 'pro' ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Pro 수정 가능
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    Free 수정 불가
                  </span>
                )}
              </div>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder={
                  profile?.plan_type === 'pro'
                    ? '한글 표시명을 입력하세요'
                    : 'Pro 유저만 수정 가능합니다'
                }
                maxLength={30}
                disabled={profile?.plan_type !== 'pro'}
                className="w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              />
              <div className="text-xs text-gray-500">
                빈칸으로 저장하면 표시명이 제거됩니다.
              </div>
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">유저명</div>
              <input
                type="text"
                value={editUsername}
                readOnly
                placeholder="마인크래프트 프로필 연동 시 자동으로 설정됩니다"
                className="w-full rounded-lg border bg-gray-50 p-2 text-gray-700"
              />
              <div className="text-xs text-gray-500">
                유저명은 아래 마인크래프트 프로필 연동에서 조회/확인 후 저장됩니다.
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveBasicProfile}
              disabled={profileSaving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileSaving ? '저장 중...' : '기본 프로필 저장'}
            </button>

            <button
              type="button"
              onClick={resetBasicProfileForm}
              disabled={profileSaving}
              className="rounded-lg bg-gray-500 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              되돌리기
            </button>
          </div>

          {profileSaveMessage && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              {profileSaveMessage}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <h2 className="text-lg font-semibold">마인크래프트 프로필 연동</h2>
            <p className="mt-1 text-sm text-gray-600">
              닉네임을 조회해 머리 이미지를 확인한 뒤 연동합니다. 연동 시 조회된 닉네임이
              유저명에 저장됩니다.
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="font-semibold">중요 안내</div>
            <p className="mt-1">
              다른 사용자의 마인크래프트 닉네임을 무단으로 연동하거나 사칭하는 행위는
              서비스 이용 제한 및 추후 운영 정책에 따른 제재 대상이 될 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>마인크래프트 닉네임</span>
                <span className={minecraftStatusMeta.className}>
                  {minecraftStatusMeta.label}
                </span>
              </div>

              <input
                type="text"
                value={minecraftNicknameInput}
                onChange={(e) => setMinecraftNicknameInput(e.target.value)}
                placeholder="예: Steve"
                maxLength={16}
                className="w-full rounded-lg border p-2"
              />

              <div className="text-xs text-gray-500">
                Java Edition 닉네임 기준으로 조회합니다.
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleLookupMinecraftProfile}
                disabled={minecraftLookupLoading}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {minecraftLookupLoading ? '조회 중...' : '조회'}
              </button>
            </div>
          </div>

          {minecraftLookupError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {minecraftLookupError}
            </div>
          )}

          {profile?.minecraft_uuid && linkedMinecraftHeadUrl && (
            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-500">현재 연동 정보</div>

              <div className="mt-3 flex items-center gap-3">
                <img
                  src={linkedMinecraftHeadUrl}
                  alt="현재 연동된 마인크래프트 머리"
                  className="h-16 w-16 rounded-lg border object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />

                <div>
                  <div className="font-medium">{profile.username ?? '-'}</div>
                  <div className="mt-1">
                    <span className={minecraftStatusMeta.className}>
                      {minecraftStatusMeta.label}
                    </span>
                  </div>
                  <div className="mt-2 break-all text-xs text-gray-500">
                    UUID: {profile.minecraft_uuid}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">생활 정보 등록</h2>
          <p className="mt-1 text-sm text-gray-600">
            가져오기는 정확도가 높아 권장되며, 직접 입력은 빠르게 등록할 수 있지만
            정확도가 낮을 수 있습니다.
          </p>
        </div>

        {!isMinecraftLinked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            마인크래프트 프로필 연동을 완료한 사용자만 생활 정보를 등록할 수 있습니다.
            먼저 위에서 닉네임 조회 및 연동을 완료해주세요.
          </div>
        )}

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={() => {
              setInputMode('manual');
              setSaveMessage('');
            }}
            className={tabClass(inputMode === 'manual')}
          >
            직접 입력
          </button>
          
        </div>

        {inputMode === 'import' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              마인크래프트에서 <code>./생활 정보</code> 결과를 그대로 붙여넣어주세요.
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[320px] w-full rounded-xl border p-4 text-sm outline-none focus:border-blue-500"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveImportProfile}
                disabled={saving || rawText.trim().length === 0 || !isMinecraftLinked}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? '저장 중...' : '파싱 후 저장'}
              </button>

              <button
                type="button"
                onClick={resetImportState}
                disabled={saving}
                className="rounded-lg bg-gray-500 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                초기화
              </button>
            </div>
          </div>
        )}

        {inputMode === 'manual' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              공통 스탯은 한 번만 입력하고, 각 직업 탭에서는 해당 직업의 숙련도 레벨,
              스킬 레벨, 도감 효과만 입력합니다.
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-lg font-semibold">공통 스탯 (total 기준)</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <IntegerField
                  label="명성 레벨"
                  value={manualForm.common.reputationLevel}
                  onChange={(value) => updateCommonStat('reputationLevel', value)}
                />
                <DecimalField
                  label="행운"
                  value={manualForm.common.luck}
                  onChange={(value) => updateCommonStat('luck', value)}
                />
                <DecimalField
                  label="감각"
                  value={manualForm.common.sense}
                  onChange={(value) => updateCommonStat('sense', value)}
                />
                <DecimalField
                  label="인내력"
                  value={manualForm.common.endurance}
                  onChange={(value) => updateCommonStat('endurance', value)}
                />
                <DecimalField
                  label="노련함"
                  value={manualForm.common.mastery}
                  onChange={(value) => updateCommonStat('mastery', value)}
                />
                <DecimalField
                  label="손재주"
                  value={manualForm.common.dexterity}
                  onChange={(value) => updateCommonStat('dexterity', value)}
                />
                {/* <DecimalField
                  label="카리스마"
                  value={manualForm.common.charisma}
                  onChange={(value) => updateCommonStat('charisma', value)}
                /> */}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="text-lg font-semibold">직업별 입력</h3>
                <p className="mt-1 text-sm text-gray-600">
                  해당 탭의 숙련도, 스킬, 도감 효과만 입력하세요.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setManualJobTab('fishing')}
                  className={tabClass(manualJobTab === 'fishing')}
                >
                  낚시
                </button>
                <button
                  type="button"
                  onClick={() => setManualJobTab('farming')}
                  className={tabClass(manualJobTab === 'farming')}
                >
                  농사
                </button>
                <button
                  type="button"
                  onClick={() => setManualJobTab('mining')}
                  className={tabClass(manualJobTab === 'mining')}
                >
                  채광
                </button>
                <button
                  type="button"
                  onClick={() => setManualJobTab('cooking')}
                  className={tabClass(manualJobTab === 'cooking')}
                >
                  요리
                </button>
              </div>

              {manualJobTab === 'fishing' && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <IntegerField
                      label="낚시 레벨"
                      value={manualForm.fishing.level}
                      onChange={(value) => updateJobLevel('fishing', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <IntegerField
                        label="보물 감지"
                        value={manualForm.fishing.skills.treasureDetection}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'treasureDetection', value)
                        }
                      />
                      <IntegerField
                        label="소문난 미끼"
                        value={manualForm.fishing.skills.famousBait}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'famousBait', value)
                        }
                      />
                      <IntegerField
                        label="낚싯줄 장력"
                        value={manualForm.fishing.skills.lineTension}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'lineTension', value)
                        }
                      />
                      <IntegerField
                        label="쌍걸이"
                        value={manualForm.fishing.skills.doubleCatch}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'doubleCatch', value)
                        }
                      />
                      <IntegerField
                        label="떼낚시"
                        value={manualForm.fishing.skills.schoolFishing}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'schoolFishing', value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">도감 효과</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DecimalField
                        label="일반 물고기 감소비율"
                        value={manualForm.fishing.codex.normalFishReduction}
                        onChange={(value) =>
                          updateJobCodex('fishing', 'normalFishReduction', value)
                        }
                      />
                      <DecimalField
                        label="기척 시간 감소"
                        value={manualForm.fishing.codex.nibbleTimeReduction}
                        onChange={(value) =>
                          updateJobCodex('fishing', 'nibbleTimeReduction', value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {manualJobTab === 'farming' && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <IntegerField
                      label="농사 레벨"
                      value={manualForm.farming.level}
                      onChange={(value) => updateJobLevel('farming', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <IntegerField
                        label="풍년의 축복"
                        value={manualForm.farming.skills.blessingOfHarvest}
                        onChange={(value) =>
                          updateJobSkill('farming', 'blessingOfHarvest', value)
                        }
                      />
                      <IntegerField
                        label="비옥한 토양"
                        value={manualForm.farming.skills.fertileSoil}
                        onChange={(value) =>
                          updateJobSkill('farming', 'fertileSoil', value)
                        }
                      />
                      <IntegerField
                        label="개간의 서약"
                        value={manualForm.farming.skills.oathOfCultivation}
                        onChange={(value) =>
                          updateJobSkill('farming', 'oathOfCultivation', value)
                        }
                      />
                      <IntegerField
                        label="수확의 손길"
                        value={manualForm.farming.skills.handOfHarvest}
                        onChange={(value) =>
                          updateJobSkill('farming', 'handOfHarvest', value)
                        }
                      />
                      <IntegerField
                        label="되뿌리기"
                        value={manualForm.farming.skills.reseeding}
                        onChange={(value) =>
                          updateJobSkill('farming', 'reseeding', value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">도감 효과</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DecimalField
                        label="일반 작물 감소비율"
                        value={manualForm.farming.codex.normalCropReduction}
                        onChange={(value) =>
                          updateJobCodex('farming', 'normalCropReduction', value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {manualJobTab === 'mining' && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <IntegerField
                      label="채광 레벨"
                      value={manualForm.mining.level}
                      onChange={(value) => updateJobLevel('mining', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <IntegerField
                        label="단련된 곡괭이"
                        value={manualForm.mining.skills.temperedPickaxe}
                        onChange={(value) =>
                          updateJobSkill('mining', 'temperedPickaxe', value)
                        }
                      />
                      <IntegerField
                        label="광맥 감각"
                        value={manualForm.mining.skills.veinSense}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinSense', value)
                        }
                      />
                      <IntegerField
                        label="광맥 흐름"
                        value={manualForm.mining.skills.veinFlow}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinFlow', value)
                        }
                      />
                      <IntegerField
                        label="광맥 탐지"
                        value={manualForm.mining.skills.veinDetection}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinDetection', value)
                        }
                      />
                      <IntegerField
                        label="폭발적인 채광"
                        value={manualForm.mining.skills.explosiveMining}
                        onChange={(value) =>
                          updateJobSkill('mining', 'explosiveMining', value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">도감 효과</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DecimalField
                        label="채광 딜레이 감소"
                        value={manualForm.mining.codex.miningDelayReduction}
                        onChange={(value) =>
                          updateJobCodex('mining', 'miningDelayReduction', value)
                        }
                      />
                      <DecimalField
                        label="채광 데미지 증가"
                        value={manualForm.mining.codex.miningDamageIncrease}
                        onChange={(value) =>
                          updateJobCodex('mining', 'miningDamageIncrease', value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {manualJobTab === 'cooking' && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <IntegerField
                      label="요리 레벨"
                      value={manualForm.cooking.level}
                      onChange={(value) => updateJobLevel('cooking', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <IntegerField
                        label="손질 달인"
                        value={manualForm.cooking.skills.preparationMaster}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'preparationMaster', value)
                        }
                      />
                      <IntegerField
                        label="맛의 균형"
                        value={manualForm.cooking.skills.balanceOfTaste}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'balanceOfTaste', value)
                        }
                      />
                      <IntegerField
                        label="미식가"
                        value={manualForm.cooking.skills.gourmet}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'gourmet', value)
                        }
                      />
                      <IntegerField
                        label="즉시 완성"
                        value={manualForm.cooking.skills.instantCompletion}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'instantCompletion', value)
                        }
                      />
                      <IntegerField
                        label="연회 준비"
                        value={manualForm.cooking.skills.banquetPreparation}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'banquetPreparation', value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">도감 효과</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <DecimalField
                        label="요리 등급업 확률"
                        value={manualForm.cooking.codex.cookingGradeUpChance}
                        onChange={(value) =>
                          updateJobCodex('cooking', 'cookingGradeUpChance', value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveManualProfile}
                disabled={saving || !isMinecraftLinked}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? '저장 중...' : '직접 입력 저장'}
              </button>

              <button
                type="button"
                onClick={handleLoadLastManualProfile}
                disabled={manualLoadLoading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {manualLoadLoading ? '불러오는 중...' : '이전 입력 불러오기'}
              </button>

              <button
                type="button"
                onClick={resetManualState}
                disabled={saving || manualLoadLoading}
                className="rounded-lg bg-gray-500 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                초기화
              </button>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm">{saveMessage}</div>
        )}
      </section>

      {parsedPreview && (
        <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">저장 결과 미리보기</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">기본 정보</h3>
              <div>명성 레벨: {parsedPreview.reputationLevel ?? '-'}</div>
              <div>낚시 레벨: {previewFishingJob?.level ?? '-'}</div>
              <div>농사 레벨: {previewFarmingJob?.level ?? '-'}</div>
              <div>채광 레벨: {previewMiningJob?.level ?? '-'}</div>
              <div>요리 레벨: {previewCookingJob?.level ?? '-'}</div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">공통 스탯 확인</h3>
              <div className="text-sm">행운: {formatStatValue(previewFishingJob?.stats?.luck)}</div>
              <div className="text-sm">감각: {formatStatValue(previewFishingJob?.stats?.sense)}</div>
              <div className="text-sm">손재주: {formatStatValue(previewCookingJob?.stats?.dexterity)}</div>
              <div className="text-sm">노련함: {formatStatValue(previewCookingJob?.stats?.mastery)}</div>
              <div className="text-sm">인내력: {formatStatValue(previewFishingJob?.stats?.endurance)}</div>
              <div className="text-sm">카리스마: {formatStatValue(previewFishingJob?.stats?.charisma)}</div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 스킬</h3>
              {previewFishingSkills.length === 0 ? (
                <div className="text-sm text-gray-500">저장된 낚시 스킬 없음</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {previewFishingSkills.map((skill) => (
                    <li key={skill.key}>
                      {skill.label}: Lv.{skill.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">농사 스킬</h3>
              {previewFarmingSkills.length === 0 ? (
                <div className="text-sm text-gray-500">저장된 농사 스킬 없음</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {previewFarmingSkills.map((skill) => (
                    <li key={skill.key}>
                      {skill.label}: Lv.{skill.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">채광 스킬</h3>
              {previewMiningSkills.length === 0 ? (
                <div className="text-sm text-gray-500">저장된 채광 스킬 없음</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {previewMiningSkills.map((skill) => (
                    <li key={skill.key}>
                      {skill.label}: Lv.{skill.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">요리 스킬</h3>
              {previewCookingSkills.length === 0 ? (
                <div className="text-sm text-gray-500">저장된 요리 스킬 없음</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {previewCookingSkills.map((skill) => (
                    <li key={skill.key}>
                      {skill.label}: Lv.{skill.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border p-4 md:col-span-2">
              <h3 className="mb-2 font-semibold">전체 skills 원본</h3>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(parsedPreview.skills ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}

      {minecraftModalOpen && minecraftPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">마인크래프트 프로필 확인</h3>
              <p className="text-sm text-gray-600">
                아래 프로필이 맞는지 확인한 뒤 연동을 완료하세요.
              </p>
            </div>

            <div className="mt-5 rounded-xl border bg-gray-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-white">
                  <img
                    src={minecraftPreview.avatarUrl}
                    alt="마인크래프트 머리 미리보기"
                    className="h-16 w-16 object-cover"
                    onError={(e) => {
                      /**
                       * 조회 확인 모달도 동일한 "머리 이미지"만 사용한다.
                       * 로딩 실패 시 이미지를 숨기고 박스만 유지한다.
                       */
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-500">조회된 닉네임</div>
                  <div className="text-lg font-semibold">
                    {minecraftPreview.nickname}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border bg-white p-3 break-all text-xs text-gray-600">
                UUID: {minecraftPreview.uuid}
              </div>

              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                다른 사용자의 닉네임을 무단으로 연동하거나 사칭하는 행위는 서비스
                이용 제한 및 처벌 대상이 될 수 있습니다.
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMinecraftModalOpen(false);
                  setMinecraftPreview(null);
                }}
                disabled={minecraftLinkSaving}
                className="rounded-lg bg-gray-500 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                onClick={handleConfirmMinecraftLink}
                disabled={minecraftLinkSaving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {minecraftLinkSaving ? '연동 저장 중...' : '확인 후 연동'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}