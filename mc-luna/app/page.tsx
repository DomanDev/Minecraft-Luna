import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '24px' }}>
      <h1>홈</h1>

      <ul>
        <li><Link href="/calculator">낚시 계산기</Link></li>
        <li><Link href="/profile">프로필</Link></li>
      </ul>
    </main>
  );
}