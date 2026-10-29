import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// No hardcoded secrets: without env vars the app shows a setup screen.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null

export const ADMIN_EMAIL = 'veducator4@gmail.com'

// Root admin always passes. Extra admins live in tp_admins (see
// supabase-tp-admins.sql); if that table does not exist yet, only the
// root admin passes. Never throws: a failed lookup means "not an admin".
export async function fetchIsAdmin(user) {
  if (!user || !user.email) return false
  const email = user.email.toLowerCase()
  if (email === ADMIN_EMAIL) return true
  if (!supabase) return false
  const { data, error } = await supabase
    .from('tp_admins')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  if (error) return false
  return !!data
}
