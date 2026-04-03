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
import { toast } from "sonner";

/**
 * profiles 테이블에서 가져오는 기본 프로필 타입
 */
type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  plan_type: 'free' | 'pro';
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
 * 숫자 input 공통 렌더링용 작은 컴포넌트
 */
function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  help?: string;
}) {
  const { label, value, onChange, step = '1', help } = props;

  return (
    <label className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(toNumberValue(e.target.value))}
        className="w-full rounded-lg border p-2"
      />
      {help && <div className="text-xs text-gray-500">{help}</div>}
    </label>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState('');

  const [inputMode, setInputMode] = useState<InputMode>('import');
  const [manualJobTab, setManualJobTab] = useState<ManualJobTab>('fishing');

  const [rawText, setRawText] = useState('');
  const [manualForm, setManualForm] =
    useState<ManualProfileState>(INITIAL_MANUAL_PROFILE);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedLifeProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, plan_type')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('프로필 조회 실패:', error);
        setProfile(null);
      } else {
        setProfile(data);
        setEditUsername(data?.username ?? '');
        setEditDisplayName(data?.display_name ?? '');
      }

      setProfileLoading(false);
    };

    fetchProfile();
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
  const updateJobLevel = (
    job: ManualJobTab,
    value: number,
  ) => {
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
   * 기본 프로필 저장
   *
   * 정책:
   * - 표시명: 모두 가능
   * - 유저명: Pro만 가능
   * - 유저명: 한글/영문/숫자/밑줄/마침표 허용
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
      const trimmedUsername = editUsername.trim();

      const canEditUsername = profile.plan_type === 'pro';
      const isUsernameChanged = trimmedUsername !== (profile.username ?? '');
      const isDisplayNameChanged =
        trimmedDisplayName !== (profile.display_name ?? '');

      if (!isUsernameChanged && !isDisplayNameChanged) {
        setProfileSaveMessage('변경된 내용이 없습니다.');
        return;
      }

      if (isUsernameChanged && !canEditUsername) {
        setProfileSaveMessage('유저명 변경은 Pro 유저만 가능합니다.');
        return;
      }

      if (isUsernameChanged) {
        const usernameRegex = /^[가-힣a-zA-Z0-9._]{2,20}$/;

        if (!usernameRegex.test(trimmedUsername)) {
          setProfileSaveMessage(
            '유저명은 2~20자의 한글, 영문, 숫자, 밑줄(_), 마침표(.)만 사용할 수 있습니다.',
          );
          return;
        }

        const { data: existingUser, error: usernameCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', trimmedUsername)
          .neq('id', user.id)
          .maybeSingle();

        if (usernameCheckError) {
          console.error('유저명 중복 확인 실패:', usernameCheckError);
          setProfileSaveMessage('유저명 중복 확인 중 오류가 발생했습니다.');
          return;
        }

        if (existingUser) {
          setProfileSaveMessage('이미 사용 중인 유저명입니다.');
          return;
        }
      }

      const updatePayload: {
        display_name: string | null;
        username?: string | null;
      } = {
        display_name: trimmedDisplayName === '' ? null : trimmedDisplayName,
      };

      if (isUsernameChanged && canEditUsername) {
        updatePayload.username = trimmedUsername === '' ? null : trimmedUsername;
      }

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
        username:
          updatePayload.username !== undefined
            ? updatePayload.username
            : profile.username,
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

  const handleSaveImportProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage("");

      if (!user) {
        const message = "사용자 정보를 불러올 수 없습니다.";
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
      setSaveMessage("생활 정보 가져오기 저장 완료");
      toast.success("생활 정보가 저장되었습니다.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "가져오기 저장 중 오류가 발생했습니다.";
      setSaveMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManualProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage("");

      if (!user) {
        const message = "사용자 정보를 불러올 수 없습니다.";
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

      setSaveMessage("직접 입력 프로필 저장 완료");
      toast.success("프로필이 저장되었습니다.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "직접 입력 저장 중 오류가 발생했습니다.";

      setSaveMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
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
            <div className="font-medium">{profile?.username ?? '-'}</div>
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
              표시명은 누구나 변경할 수 있고, 유저명은 Pro 유저만 변경할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <div className="text-sm font-medium">표시명</div>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="표시명을 입력하세요"
                maxLength={30}
                className="w-full rounded-lg border p-2"
              />
              <div className="text-xs text-gray-500">
                빈칸으로 저장하면 표시명이 제거됩니다.
              </div>
            </label>

            <label className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>유저명</span>
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
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder={
                  profile?.plan_type === 'pro'
                    ? '유저명을 입력하세요'
                    : 'Pro 유저만 수정 가능합니다'
                }
                maxLength={20}
                disabled={profile?.plan_type !== 'pro'}
                className="w-full rounded-lg border p-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              />

              <div className="text-xs text-gray-500">
                2~20자 한글, 영문, 숫자, 밑줄(_), 마침표(.) 사용 가능
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
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">생활 정보 등록</h2>
          <p className="mt-1 text-sm text-gray-600">
            가져오기는 정확도가 높아 권장되며, 직접 입력은 빠르게 등록할 수 있지만
            정확도가 낮을 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setInputMode('import');
              setSaveMessage('');
            }}
            className={tabClass(inputMode === 'import')}
          >
            가져오기
          </button>

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
                disabled={saving || rawText.trim().length === 0}
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
                <NumberField
                  label="명성 레벨"
                  value={manualForm.common.reputationLevel}
                  onChange={(value) => updateCommonStat('reputationLevel', value)}
                />
                <NumberField
                  label="행운"
                  step="0.1"
                  value={manualForm.common.luck}
                  onChange={(value) => updateCommonStat('luck', value)}
                />
                <NumberField
                  label="감각"
                  step="0.1"
                  value={manualForm.common.sense}
                  onChange={(value) => updateCommonStat('sense', value)}
                />
                <NumberField
                  label="인내력"
                  step="0.1"
                  value={manualForm.common.endurance}
                  onChange={(value) => updateCommonStat('endurance', value)}
                />
                <NumberField
                  label="노련함"
                  step="0.1"
                  value={manualForm.common.mastery}
                  onChange={(value) => updateCommonStat('mastery', value)}
                />
                <NumberField
                  label="손재주"
                  step="0.1"
                  value={manualForm.common.dexterity}
                  onChange={(value) => updateCommonStat('dexterity', value)}
                />
                <NumberField
                  label="카리스마"
                  step="0.1"
                  value={manualForm.common.charisma}
                  onChange={(value) => updateCommonStat('charisma', value)}
                />
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
                    <NumberField
                      label="낚시 레벨"
                      value={manualForm.fishing.level}
                      onChange={(value) => updateJobLevel('fishing', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="보물 감지"
                        value={manualForm.fishing.skills.treasureDetection}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'treasureDetection', value)
                        }
                      />
                      <NumberField
                        label="소문난 미끼"
                        value={manualForm.fishing.skills.famousBait}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'famousBait', value)
                        }
                      />
                      <NumberField
                        label="낚싯줄 장력"
                        value={manualForm.fishing.skills.lineTension}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'lineTension', value)
                        }
                      />
                      <NumberField
                        label="쌍걸이"
                        value={manualForm.fishing.skills.doubleCatch}
                        onChange={(value) =>
                          updateJobSkill('fishing', 'doubleCatch', value)
                        }
                      />
                      <NumberField
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
                      <NumberField
                        label="일반 물고기 감소비율"
                        step="0.1"
                        value={manualForm.fishing.codex.normalFishReduction}
                        onChange={(value) =>
                          updateJobCodex('fishing', 'normalFishReduction', value)
                        }
                      />
                      <NumberField
                        label="기척 시간 감소"
                        step="0.1"
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
                    <NumberField
                      label="농사 레벨"
                      value={manualForm.farming.level}
                      onChange={(value) => updateJobLevel('farming', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="풍년의 축복"
                        value={manualForm.farming.skills.blessingOfHarvest}
                        onChange={(value) =>
                          updateJobSkill('farming', 'blessingOfHarvest', value)
                        }
                      />
                      <NumberField
                        label="비옥한 토양"
                        value={manualForm.farming.skills.fertileSoil}
                        onChange={(value) =>
                          updateJobSkill('farming', 'fertileSoil', value)
                        }
                      />
                      <NumberField
                        label="개간의 서약"
                        value={manualForm.farming.skills.oathOfCultivation}
                        onChange={(value) =>
                          updateJobSkill('farming', 'oathOfCultivation', value)
                        }
                      />
                      <NumberField
                        label="수확의 손길"
                        value={manualForm.farming.skills.handOfHarvest}
                        onChange={(value) =>
                          updateJobSkill('farming', 'handOfHarvest', value)
                        }
                      />
                      <NumberField
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
                      <NumberField
                        label="일반 작물 감소비율"
                        step="0.1"
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
                    <NumberField
                      label="채광 레벨"
                      value={manualForm.mining.level}
                      onChange={(value) => updateJobLevel('mining', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="단련된 곡괭이"
                        value={manualForm.mining.skills.temperedPickaxe}
                        onChange={(value) =>
                          updateJobSkill('mining', 'temperedPickaxe', value)
                        }
                      />
                      <NumberField
                        label="광맥 감각"
                        value={manualForm.mining.skills.veinSense}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinSense', value)
                        }
                      />
                      <NumberField
                        label="광맥 흐름"
                        value={manualForm.mining.skills.veinFlow}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinFlow', value)
                        }
                      />
                      <NumberField
                        label="광맥 탐지"
                        value={manualForm.mining.skills.veinDetection}
                        onChange={(value) =>
                          updateJobSkill('mining', 'veinDetection', value)
                        }
                      />
                      <NumberField
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
                      <NumberField
                        label="채광 딜레이 감소"
                        step="0.1"
                        value={manualForm.mining.codex.miningDelayReduction}
                        onChange={(value) =>
                          updateJobCodex('mining', 'miningDelayReduction', value)
                        }
                      />
                      <NumberField
                        label="채광 데미지 증가"
                        step="0.1"
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
                    <NumberField
                      label="요리 레벨"
                      value={manualForm.cooking.level}
                      onChange={(value) => updateJobLevel('cooking', value)}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <h4 className="text-base font-semibold">스킬 레벨</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="손질 달인"
                        value={manualForm.cooking.skills.preparationMaster}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'preparationMaster', value)
                        }
                      />
                      <NumberField
                        label="맛의 균형"
                        value={manualForm.cooking.skills.balanceOfTaste}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'balanceOfTaste', value)
                        }
                      />
                      <NumberField
                        label="미식가"
                        value={manualForm.cooking.skills.gourmet}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'gourmet', value)
                        }
                      />
                      <NumberField
                        label="즉시 완성"
                        value={manualForm.cooking.skills.instantCompletion}
                        onChange={(value) =>
                          updateJobSkill('cooking', 'instantCompletion', value)
                        }
                      />
                      <NumberField
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
                      <NumberField
                        label="요리 등급업 확률"
                        step="0.1"
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
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? '저장 중...' : '직접 입력 저장'}
              </button>

              <button
                type="button"
                onClick={resetManualState}
                disabled={saving}
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
    </div>
  );
}