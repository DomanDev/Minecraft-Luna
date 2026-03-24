'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('로그인 성공')
    window.location.href = '/profile'
  }

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('회원가입 완료')
  }

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-xl font-bold">로그인</h1>

      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full"
      />

      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full"
      />

      <div className="flex gap-2">
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          로그인
        </button>

        <button
          onClick={handleSignup}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          회원가입
        </button>
      </div>
    </div>
  )
}