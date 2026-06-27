/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少 Supabase 环境变量：请确认 .env.local 中已配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，并重启开发服务器。'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
