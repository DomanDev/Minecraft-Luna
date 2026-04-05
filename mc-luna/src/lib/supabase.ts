import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://kygilmxxlifavfflwueu.supabase.co"
const supabaseAnonKey = "sb_publishable_7RVLSmc6GujWzp3SJ9JAWA_SbxCfPc9"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);