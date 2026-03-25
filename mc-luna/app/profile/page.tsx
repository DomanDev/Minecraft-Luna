'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../src/hooks/useAuth'
import { supabase } from '../../src/lib/supabase'
import { saveLifeProfileFromText } from '../../src/lib/save-life-profile'
import { ParsedLifeProfile } from '../../src/types/life-profile'
/*
[프로필 페이지]
-로그인 상태 확인
-기본 프로필 표시
-생활 정보 붙여넣기
-파싱/저장 실행
-결과 미리보기
**/
type Profile = {
  id: string
  username: string
  display_name: string
  plan_type: 'free' | 'pro'
}

export default function ProfilePage() {
  const { user, loading } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [rawText, setRawText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [parsedPreview, setParsedPreview] = useState<ParsedLifeProfile | null>(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    const fetchProfile = async () => {
      setProfileLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, plan_type')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('프로필 조회 실패:', error)
        setProfile(null)
      } else {
        setProfile(data)
      }

      setProfileLoading(false)
    }

    fetchProfile()
  }, [user])

  const handleSaveLifeProfile = async () => {
    try {
      setSaving(true)
      setSaveMessage('')

      const parsed = await saveLifeProfileFromText(rawText)
      setParsedPreview(parsed)
      setSaveMessage('생활 정보 저장 완료')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.'
      setSaveMessage(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10">로그인 확인 중...</div>
  if (!user) return <div className="p-10">로그인이 필요합니다.</div>
  if (profileLoading) return <div className="p-10">프로필 불러오는 중...</div>

  return (
    <div className="p-10 space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">프로필</h1>
        <div>이메일: {user.email}</div>
        <div>유저명: {profile?.username}</div>
        <div>표시명: {profile?.display_name}</div>
        <div>플랜: {profile?.plan_type}</div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">생활 정보 가져오기</h2>

        <p className="text-sm text-gray-600">
          마인크래프트에서 <code>./생활 정보</code> 결과를 그대로 붙여넣어주세요.
        </p>

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
            ㆍ낚시 Lv.10

            [스킬]
            ㆍ보물 감지 Lv.3
            ㆍ소문난 미끼 Lv.5
            ㆍ낚싯줄 장력 Lv.10
            ㆍ쌍걸이 Lv.4
            ㆍ떼낚시 Lv.2`}
          className="w-full min-h-[320px] rounded border p-4"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSaveLifeProfile}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? '저장 중...' : '파싱 후 저장'}
          </button>

          <button
            onClick={() => {
              setRawText('')
              setParsedPreview(null)
              setSaveMessage('')
            }}
            disabled={saving}
            className="rounded bg-gray-500 px-4 py-2 text-white disabled:opacity-50"
          >
            초기화
          </button>
        </div>

        {saveMessage && (
          <div className="rounded border bg-gray-50 p-3 text-sm">
            {saveMessage}
          </div>
        )}
      </section>

      {parsedPreview && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">파싱 결과 미리보기</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">기본 정보</h3>
              <div>명성 레벨: {parsedPreview.reputationLevel ?? '-'}</div>
              <div>낚시 레벨: {parsedPreview.fishingLevel ?? '-'}</div>
            </div>

            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">낚시 스킬</h3>
              {parsedPreview.fishingSkills.length === 0 ? (
                <div>파싱된 낚시 스킬 없음</div>
              ) : (
                <ul className="space-y-1">
                  {parsedPreview.fishingSkills.map((skill) => (
                    <li key={skill.name}>
                      {skill.name}: Lv.{skill.level}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">행운</h3>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(parsedPreview.luck, null, 2)}
              </pre>
            </div>

            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">감각</h3>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(parsedPreview.sense, null, 2)}
              </pre>
            </div>

            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">어획량 증가율</h3>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(parsedPreview.fishingYieldBonus, null, 2)}
              </pre>
            </div>

            <div className="rounded border p-4">
              <h3 className="mb-2 font-semibold">일반 물고기 감소비율</h3>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(parsedPreview.normalFishReduction, null, 2)}
              </pre>
            </div>

            <div className="rounded border p-4 md:col-span-2">
              <h3 className="mb-2 font-semibold">기척 시간 감소</h3>
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(parsedPreview.nibbleTimeReduction, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}