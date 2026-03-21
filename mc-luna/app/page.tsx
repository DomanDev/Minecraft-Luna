import { supabase } from '../src/lib/supabase';

export default async function Home() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*');

  return (
    <main style={{ padding: '24px' }}>
      <h1>Supabase 연결 테스트</h1>
      <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
    </main>
  );
}