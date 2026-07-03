import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured =
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'your_supabase_url_here' &&
  supabaseKey !== 'your_supabase_anon_key_here'

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseConfigured = () => isConfigured
