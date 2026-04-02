'use client';

/**
 * [프로필 페이지]
 *
 * 이번 버전의 핵심 목적:
 * 1) 기존 "생활 정보 가져오기(import)" 기능 유지
 * 2) 새로 "직접 입력(manual)" 기능 추가
 * 3) 새 life-profile 구조(jobs / skills)에 맞춰 미리보기와 저장 흐름 통일
 *
 * 설계 포인트:
 * - 입력 방식은 "import" / "manual" 두 가지 탭으로 분리
 * - 저장 후에는 항상 ParsedLifeProfile 표준 구조를 preview로 보여줌
 * - 지금은 manual 입력을 우선 낚시 중심으로 구현
 *   (구조는 확장 가능하게 작성)
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

/**
 * profiles 테이블에서 가져오는 기본 프로필 타입
 */
type Profile = {
  id: string;
  username: string;
  display_name: string;
  plan_type: 'free' | 'pro';
};

/**
 * 화면에서 탭 상태를 구분하기 위한 타입
 */
type InputMode = 'import' | 'manual';

/**
 * 직접 입력 폼용 로컬 state 타입
 *
 * 이유:
 * - ManualLifeProfileInput을 그대로 state로 쓰면
 *   input value 연결 시 코드가 너무 장황해짐
 * - UI에서는 평평한(flat) 구조가 관리가 편함
 * - 저장 직전에 ManualLifeProfileInput 형태로 변환
 */
type ManualFishingFormState = {
  reputationLevel: number;
  fishingLevel: number;

  luck: number;
  sense: number;
  fishingYieldBonus: number;
  normalFishReduction: number;
  nibbleTimeReduction: number;

  treasureDetection: number;
  famousBait: number;
  lineTension: number;
  doubleCatch: number;
  schoolFishing: number;
};

/**
 * 직접 입력 기본값
 *
 * 새로고침 / 초기화 / 저장 후 리셋 등에 재사용하기 위해
 * 상수로 분리
 */
const INITIAL_MANUAL_FORM: ManualFishingFormState = {
  reputationLevel: 0,
  fishingLevel: 0,

  luck: 0,
  sense: 0,
  fishingYieldBonus: 0,
  normalFishReduction: 0,
  nibbleTimeReduction: 0,

  treasureDetection: 0,
  famousBait: 0,
  lineTension: 0,
  doubleCatch: 0,
  schoolFishing: 0,
};

/**
 * 낚시 / 농사 스킬 라벨 매핑
 *
 * parsedPreview.skills는 영문 key 중심 구조이므로
 * 화면에서는 사용자가 읽기 쉬운 한글 이름으로 다시 보여준다.
 */
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

/**
 * 화면에서 숫자 input 값을 안정적으로 number로 변환
 *
 * 주의:
 * - input.value는 항상 string이다.
 * - 빈 문자열이 들어오면 Number('') === 0 이 되긴 하지만
 *   의도를 명확히 하기 위해 직접 처리
 * - 숫자가 아니면 0으로 보정
 */
function toNumberValue(value: string): number {
  if (value.trim() === '') return 0;

  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * ParsedStatValue를 화면용 문자열로 예쁘게 표시
 *
 * 예:
 * base: 22 / temp: 0.7 / equip: 0 / total: 22.7
 */
function formatStatValue(stat: ParsedStatValue | undefined): string {
  if (!stat) return '-';
  return `base: ${stat.base} / temp: ${stat.temp} / equip: ${stat.equip} / total: ${stat.total}`;
}

/**
 * 직접 입력용 로컬 state를
 * saveManualLifeProfile이 요구하는 ManualLifeProfileInput으로 변환
 *
 * 핵심 정책:
 * - manual 입력은 total 중심
 * - base / temp / equip는 normalize 단계에서 0 처리
 */
function buildManualLifeProfileInput(
  form: ManualFishingFormState,
): ManualLifeProfileInput {
  return {
    reputationLevel: form.reputationLevel,
    jobs: {
      fishing: {
        level: form.fishingLevel,
        stats: {
          luck: { total: form.luck },
          sense: { total: form.sense },
          fishingYieldBonus: { total: form.fishingYieldBonus },
          normalFishReduction: { total: form.normalFishReduction },
          nibbleTimeReduction: { total: form.nibbleTimeReduction },
        },
      },
    },
    skills: {
      fishing: {
        treasureDetection: form.treasureDetection,
        famousBait: form.famousBait,
        lineTension: form.lineTension,
        doubleCatch: form.doubleCatch,
        schoolFishing: form.schoolFishing,
      },
    },
  };
}

export default function ProfilePage() {
  const { user, loading } = useAuth();

  /**
   * 기본 프로필 표시용 state
   */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  /**
   * 입력 방식 탭
   * - import: 생활 정보 텍스트 붙여넣기
   * - manual: 직접 입력
   */
  const [inputMode, setInputMode] = useState<InputMode>('import');

  /**
   * import용 입력 state
   */
  const [rawText, setRawText] = useState('');

  /**
   * manual용 입력 state
   */
  const [manualForm, setManualForm] =
    useState<ManualFishingFormState>(INITIAL_MANUAL_FORM);

  /**
   * 공통 저장/결과 state
   */
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedLifeProfile | null>(null);

  /**
   * 로그인 사용자 기준으로 profiles 테이블에서
   * 표시용 기본 프로필을 조회
   */
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
      }

      setProfileLoading(false);
    };

    fetchProfile();
  }, [user]);

  /**
   * 직접 입력 폼 업데이트 함수
   *
   * 사용 예:
   * updateManualField('luck', 22.7)
   */
  const updateManualField = <K extends keyof ManualFishingFormState>(
    key: K,
    value: ManualFishingFormState[K],
  ) => {
    setManualForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * import 방식 저장
   *
   * 기대 흐름:
   * 1) rawText를 parser로 파싱
   * 2) DB 저장
   * 3) 저장된 parsed 결과를 반환받아 preview 표시
   */
  const handleSaveImportProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage('');

      if (!user) {
        setSaveMessage('사용자 정보를 불러올 수 없습니다.');
        return;
      }

      const parsed = await saveLifeProfileFromText(user.id, rawText);

      setParsedPreview(parsed);
      setSaveMessage('생활 정보 가져오기 저장 완료');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '가져오기 저장 중 오류가 발생했습니다.';
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * manual 방식 저장
   *
   * 기대 흐름:
   * 1) 화면용 state -> ManualLifeProfileInput 변환
   * 2) saveManualLifeProfile 호출
   * 3) ParsedLifeProfile 반환값을 preview에 반영
   */
  const handleSaveManualProfile = async () => {
    try {
      setSaving(true);
      setSaveMessage('');

      if (!user) {
        setSaveMessage('사용자 정보를 불러올 수 없습니다.');
        return;
      }

      const manualInput = buildManualLifeProfileInput(manualForm);
      const parsed = await saveManualLifeProfile(user.id, manualInput);

      setParsedPreview(parsed);
      setSaveMessage('직접 입력 프로필 저장 완료');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '직접 입력 저장 중 오류가 발생했습니다.';
      setSaveMessage(message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * import 영역 초기화
   */
  const resetImportState = () => {
    setRawText('');
    setParsedPreview(null);
    setSaveMessage('');
  };

  /**
   * manual 영역 초기화
   */
  const resetManualState = () => {
    setManualForm(INITIAL_MANUAL_FORM);
    setParsedPreview(null);
    setSaveMessage('');
  };

  /**
   * preview에서 낚시 스킬 목록 추출
   */
  const previewFishingSkills = useMemo(() => {
    const fishingSkills = parsedPreview?.skills?.fishing ?? {};

    return Object.entries(FISHING_SKILL_LABELS)
      .filter(([skillKey]) => fishingSkills[skillKey] != null)
      .map(([skillKey, label]) => ({
        key: skillKey,
        label,
        level: fishingSkills[skillKey],
      }));
  }, [parsedPreview]);

  /**
   * preview에서 농사 스킬 목록 추출
   */
  const previewFarmingSkills = useMemo(() => {
    const farmingSkills = parsedPreview?.skills?.farming ?? {};

    return Object.entries(FARMING_SKILL_LABELS)
      .filter(([skillKey]) => farmingSkills[skillKey] != null)
      .map(([skillKey, label]) => ({
        key: skillKey,
        label,
        level: farmingSkills[skillKey],
      }));
  }, [parsedPreview]);

  /**
   * preview에서 자주 참조하는 직업/스탯을 미리 분리
   *
   * 이렇게 빼두면 JSX에서 optional chaining이 덜 길어져
   * 읽기 쉬워진다.
   */
  const previewFishingJob = parsedPreview?.jobs?.fishing;
  const previewFarmingJob = parsedPreview?.jobs?.farming;

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
      {/* =========================
          기본 프로필 영역
         ========================= */}
      <section className="space-y-3 rounded-xl border bg-white p-6 shadow-sm">
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
      </section>

      {/* =========================
          입력 방식 탭 영역
         ========================= */}
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
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === 'import'
                ? 'bg-blue-600 text-white'
                : 'border bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            가져오기
          </button>

          <button
            type="button"
            onClick={() => {
              setInputMode('manual');
              setSaveMessage('');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'border bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            직접 입력
          </button>
        </div>

        {/* =========================
            가져오기 탭
           ========================= */}
        {inputMode === 'import' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              마인크래프트에서 <code>./생활 정보</code> 결과를 그대로 붙여넣어주세요.
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`예시)
===== 생활 정보 =====
명성: 13 (3,220.8 / 59,700, 5.39%)

[스탯 정보]
ㆍ행운 (base:22 / temp:0.7 / equip:0 / total:22.7)
ㆍ감각 (base:18 / temp:0 / equip:0 / total:18)
ㆍ어획량 증가율 (base:0 / temp:0 / equip:0 / total:0)
ㆍ일반 물고기 감소비율 (base:0 / temp:0 / equip:0 / total:0)
ㆍ기척 시간 감소 (base:0 / temp:0 / equip:0 / total:0)

[숙련도]
ㆍ낚시 숙련도: 10
ㆍ농사 숙련도: 13

[스킬]
ㆍ보물 감지 Lv. 3
ㆍ소문난 미끼 Lv. 5
ㆍ낚싯줄 장력 Lv. 10
ㆍ쌍걸이 Lv. 4
ㆍ떼낚시 Lv. 2
ㆍ풍년의 축복 Lv. 20
ㆍ비옥한 토양 Lv. 8
ㆍ개간의 서약 Lv. 20`}
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

        {/* =========================
            직접 입력 탭
           ========================= */}
        {inputMode === 'manual' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              직접 입력은 빠르게 등록할 수 있지만, 수동 입력 실수로 인해 실제 게임 내
              수치와 달라질 수 있습니다. 가능하면 가져오기 사용을 권장합니다.
            </div>

            {/* 기본 정보 */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-lg font-semibold">기본 정보</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-sm font-medium">명성 레벨</div>
                  <input
                    type="number"
                    value={manualForm.reputationLevel}
                    onChange={(e) =>
                      updateManualField('reputationLevel', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">낚시 레벨</div>
                  <input
                    type="number"
                    value={manualForm.fishingLevel}
                    onChange={(e) =>
                      updateManualField('fishingLevel', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>
              </div>
            </div>

            {/* 낚시 스탯 */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-lg font-semibold">낚시 스탯 (total 기준)</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-sm font-medium">행운</div>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.luck}
                    onChange={(e) =>
                      updateManualField('luck', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">감각</div>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.sense}
                    onChange={(e) =>
                      updateManualField('sense', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">어획량 증가율</div>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.fishingYieldBonus}
                    onChange={(e) =>
                      updateManualField(
                        'fishingYieldBonus',
                        toNumberValue(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">일반 물고기 감소비율</div>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.normalFishReduction}
                    onChange={(e) =>
                      updateManualField(
                        'normalFishReduction',
                        toNumberValue(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-sm font-medium">기척 시간 감소</div>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.nibbleTimeReduction}
                    onChange={(e) =>
                      updateManualField(
                        'nibbleTimeReduction',
                        toNumberValue(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>
              </div>
            </div>

            {/* 낚시 스킬 */}
            <div className="space-y-3 rounded-xl border p-4">
              <h3 className="text-lg font-semibold">낚시 스킬 레벨</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-sm font-medium">보물 감지</div>
                  <input
                    type="number"
                    value={manualForm.treasureDetection}
                    onChange={(e) =>
                      updateManualField(
                        'treasureDetection',
                        toNumberValue(e.target.value),
                      )
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">소문난 미끼</div>
                  <input
                    type="number"
                    value={manualForm.famousBait}
                    onChange={(e) =>
                      updateManualField('famousBait', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">낚싯줄 장력</div>
                  <input
                    type="number"
                    value={manualForm.lineTension}
                    onChange={(e) =>
                      updateManualField('lineTension', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-sm font-medium">쌍걸이</div>
                  <input
                    type="number"
                    value={manualForm.doubleCatch}
                    onChange={(e) =>
                      updateManualField('doubleCatch', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <div className="text-sm font-medium">떼낚시</div>
                  <input
                    type="number"
                    value={manualForm.schoolFishing}
                    onChange={(e) =>
                      updateManualField('schoolFishing', toNumberValue(e.target.value))
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </label>
              </div>
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

      {/* =========================
          저장 결과 미리보기
         ========================= */}
      {parsedPreview && (
        <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">저장 결과 미리보기</h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 기본 정보 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">기본 정보</h3>
              <div>명성 레벨: {parsedPreview.reputationLevel ?? '-'}</div>
              <div>낚시 레벨: {previewFishingJob?.level ?? '-'}</div>
              <div>농사 레벨: {previewFarmingJob?.level ?? '-'}</div>
            </div>

            {/* 낚시 스킬 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 스킬</h3>
              {previewFishingSkills.length === 0 ? (
                <div className="text-sm text-gray-500">파싱된 낚시 스킬 없음</div>
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

            {/* 농사 스킬 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">농사 스킬</h3>
              {previewFarmingSkills.length === 0 ? (
                <div className="text-sm text-gray-500">파싱된 농사 스킬 없음</div>
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

            {/* 전체 skills 원본 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">전체 skills 원본</h3>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(parsedPreview.skills ?? {}, null, 2)}
              </pre>
            </div>

            {/* 낚시 스탯 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 - 행운</h3>
              <div className="text-sm">
                {formatStatValue(previewFishingJob?.stats?.luck)}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 - 감각</h3>
              <div className="text-sm">
                {formatStatValue(previewFishingJob?.stats?.sense)}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 - 어획량 증가율</h3>
              <div className="text-sm">
                {formatStatValue(previewFishingJob?.stats?.fishingYieldBonus)}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">낚시 - 일반 물고기 감소비율</h3>
              <div className="text-sm">
                {formatStatValue(previewFishingJob?.stats?.normalFishReduction)}
              </div>
            </div>

            <div className="rounded-xl border p-4 md:col-span-2">
              <h3 className="mb-2 font-semibold">낚시 - 기척 시간 감소</h3>
              <div className="text-sm">
                {formatStatValue(previewFishingJob?.stats?.nibbleTimeReduction)}
              </div>
            </div>

            {/* 농사 공통 스탯도 같이 확인 가능하게 출력 */}
            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">농사 - 행운</h3>
              <div className="text-sm">
                {formatStatValue(previewFarmingJob?.stats?.luck)}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 font-semibold">농사 - 감각</h3>
              <div className="text-sm">
                {formatStatValue(previewFarmingJob?.stats?.sense)}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}