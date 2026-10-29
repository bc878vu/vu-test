import { supabase } from './supabaseClient'
import seed from './seed.json'

function normalizeList(rows, tableKey) {
  return (rows || []).map((r) => ({
    ...r,
    table: r[tableKey] !== undefined ? r[tableKey] : r.table || null,
  }))
}

// Load subjects + questions from Supabase. If the tables are empty (SQL file not
// run yet), fall back to the bundled verified seed content so students can
// still practise; admin edits require the database.
export async function loadContent() {
  if (!supabase) {
    return {
      subjects: seed.subjects,
      mcqs: seed.mcqs,
      shorts: seed.shorts,
      longs: seed.longs,
      fromSeed: true,
      dbMissing: true,
    }
  }
  const [s, m, sh, lo] = await Promise.all([
    supabase.from('tp_subjects').select('*').order('code'),
    supabase.from('tp_mcqs').select('*').order('created_at'),
    supabase.from('tp_short_questions').select('*').order('created_at'),
    supabase.from('tp_long_questions').select('*').order('created_at'),
  ])
  if (s.error || !s.data || s.data.length === 0) {
    return {
      subjects: seed.subjects,
      mcqs: seed.mcqs,
      shorts: seed.shorts,
      longs: seed.longs,
      fromSeed: true,
      dbMissing: !!s.error,
    }
  }
  return {
    subjects: s.data,
    mcqs: m.data || [],
    shorts: normalizeList(sh.data, 'table_json'),
    longs: normalizeList(lo.data, 'table_json'),
    fromSeed: false,
    dbMissing: false,
  }
}

export async function upsertProfile(user) {
  if (!supabase || !user) return
  await supabase
    .from('tp_profiles')
    .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
}

export async function saveAttempt({ userId, subject, type, score, total, details }) {
  if (!supabase || !userId) return { ok: false, reason: 'no-db' }
  const { error } = await supabase.from('tp_attempts').insert({
    user_id: userId,
    subject_id: subject ? subject.id : null,
    subject_code: subject ? subject.code : '',
    type,
    score,
    total,
    details: details || {},
  })
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function fetchMyAttempts(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('tp_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function readAccessCode() {
  if (!supabase) return { code: null, error: 'Supabase is not configured.' }
  const { data, error } = await supabase
    .from('tp_settings')
    .select('value')
    .eq('key', 'access_code')
    .maybeSingle()
  if (error) return { code: null, error: 'Setup is incomplete: run supabase-tp.sql first.' }
  if (!data) return { code: '', error: null }
  return { code: data.value || '', error: null }
}
