import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key'

// Server-side client (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Browser client (anon access — read only due to RLS)
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey)
