import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// No hardcoded secrets: without env vars the app shows a setup screen.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null

export const ADMIN_EMAIL = 'veducator4@gmail.com'

export function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL
}
