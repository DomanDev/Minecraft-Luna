'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../src/hooks/useAuth'
import { supabase } from '../../src/lib/supabase'

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

  if (loading) return <div className="p-10">로그인 확인 중...</div>
  if (!user) return <div className="p-10">로그인이 필요합니다.</div>
  if (profileLoading) return <div className="p-10">프로필 불러오는 중...</div>

  return (
    <div className="p-10 space-y-3">
      <h1 className="text-xl font-bold">프로필</h1>

      <div>이메일: {user.email}</div>
      <div>유저명: {profile?.username}</div>
      <div>표시명: {profile?.display_name}</div>
      <div>플랜: {profile?.plan_type}</div>
    </div>
  )
}