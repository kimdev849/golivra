import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

export const hasSupabaseKeys = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseKeys) {
  console.warn('⚠️ Supabase keys missing. Realtime features disabled.');
}

// Use valid placeholder format when keys are missing to prevent createClient from throwing at startup.
const finalUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const finalKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-key';

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});
