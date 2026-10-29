import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { supabase } from './supabaseClient'
import { loadContent } from './data.js'
import { Tex } from './Tex.jsx'

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 500
const MAX_TEXT_LENGTH = 20000

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validText(value, max = MAX_TEXT_LENGTH) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function validLectureNo(value) {
  if (value === null || value === undefined || value === '') return true
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 1000
}

function validMcqItem(item) {
  return (
    isRecord(item) &&
    validText(item.question) &&
    Array.isArray(item.options) &&
    item.options.length === 4 &&
    item.options.every((option) => validText(option, 5000)) &&
    Number.isInteger(item.correct_index) &&
    item.correct_index >= 0 &&
    item.correct_index <= 3 &&
    validLectureNo(item.lecture_no) &&
    (item.explanation === undefined ||
      item.explanation === null ||
      (typeof item.explanation === 'string' && item.explanation.length <= MAX_TEXT_LENGTH))
  )
}

function validSubjectiveItem(item) {
  return (
    isRecord(item) &&
    validText(item.question) &&
    validText(item.answer) &&
    validLectureNo(item.lecture_no) &&
    (item.marks === undefined ||
      item.marks === null ||
      (Number.isInteger(item.marks) && item.marks >= 1 && item.marks <= 1000))
  )
}

function JsonFileInput({ onText, label, setMsg }) {
  return (
    <Field label={label || 'Or upload a JSON file'}>
      <input
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const input = e.currentTarget
          const file = input.files && input.files[0]
          if (!file) return
          if (file.size > MAX_IMPORT_BYTES) {
            setMsg('JSON file is too large. Maximum file size is 5 MB.')
            input.value = ''
            return
          }
          try {
            onText(await file.text())
            setMsg(`Loaded ${file.name}. Review the JSON, then select Add all.`)
          } catch {
            setMsg('Could not read the selected JSON file.')
          } finally {
            input.value = ''
          }
        }}
      />
    </Field>
  )
}

export default function Admin({ onReload }) {
  const [tab, setTab] = useState('subjects')
  const [content, setContent] = useState(null)
  const [msg, setMsg] = useState('')

  async function refresh() {
    const c = await loadContent()
    setContent(c)
    if (onReload) onReload()
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supabase) return <p className="card">Supabase is not configured.</p>
  if (!content) return <p>Loading admin…</p>
  if (content.fromSeed) {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p>
          The database tables are empty or the SQL file has not been run yet, so
          admin editing is unavailable. Run <code>supabase-tp.sql</code> in the
          Supabase SQL editor first, then reload this page.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2>Admin panel</h2>
      <div className="tabs">
        {['subjects', 'mcqs', 'subjective', 'progress', 'settings', 'admins'].map((t) => (
          <button
            key={t}
            className={tab === t ? 'primary' : ''}
            onClick={() => {
              setTab(t)
              setMsg('')
            }}
          >
            {t === 'mcqs' ? 'MCQs' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {msg && <div className="result">{msg}</div>}
      {tab === 'subjects' && (
        <SubjectsTab content={content} refresh={refresh} setMsg={setMsg} />
      )}
      {tab === 'mcqs' && (
        <McqsTab content={content} refresh={refresh} setMsg={setMsg} />
      )}
      {tab === 'subjective' && (
        <SubjectiveTab content={content} refresh={refresh} setMsg={setMsg} />
      )}
      {tab === 'progress' && <ProgressTab setMsg={setMsg} />}
      {tab === 'settings' && <SettingsTab setMsg={setMsg} />}
      {tab === 'admins' && <AdminsTab setMsg={setMsg} />}
    </div>
  )
}

function SubjectsTab({ content, refresh, setMsg }) {
  const [form, setForm] = useState({ id: null, code: '', name: '', term: 'Midterm', scope: 'Lectures 1-22' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      setMsg('Subject code and name are required.')
      return
    }
    let res
    if (form.id) {
      res = await supabase
        .from('tp_subjects')
        .update({ code: form.code.trim(), name: form.name.trim(), term: form.term, scope: form.scope })
        .eq('id', form.id)
    } else {
      res = await supabase.from('tp_subjects').insert({
        code: form.code.trim(),
        name: form.name.trim(),
        term: form.term,
        scope: form.scope,
      })
    }
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Subject saved.')
      setForm({ id: null, code: '', name: '', term: 'Midterm', scope: 'Lectures 1-22' })
      refresh()
    }
  }

  async function remove(id, code) {
    if (!window.confirm(`Delete subject ${code} and ALL its questions?`)) return
    const res = await supabase.from('tp_subjects').delete().eq('id', id)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Subject deleted.')
      refresh()
    }
  }

  return (
    <div>
      <form className="card" onSubmit={save}>
        <h3>{form.id ? 'Edit subject' : 'Add subject'}</h3>
        <Field label="Code (e.g. PHY101)">
          <input value={form.code} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Term">
          <input value={form.term} onChange={(e) => set('term', e.target.value)} />
        </Field>
        <Field label="Scope">
          <input value={form.scope} onChange={(e) => set('scope', e.target.value)} />
        </Field>
        <button className="primary" type="submit">
          Save subject
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() =>
              setForm({ id: null, code: '', name: '', term: 'Midterm', scope: 'Lectures 1-22' })
            }
          >
            Cancel edit
          </button>
        )}
      </form>
      {content.subjects.map((s) => (
        <div key={s.id} className="card row">
          <div>
            <strong>{s.code}</strong> — {s.name} ({s.term}, {s.scope})
          </div>
          <div>
            <button onClick={() => setForm({ id: s.id, code: s.code, name: s.name, term: s.term, scope: s.scope })}>
              Edit
            </button>{' '}
            <button onClick={() => remove(s.id, s.code)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function McqsTab({ content, refresh, setMsg }) {
  const [subjectId, setSubjectId] = useState(content.subjects[0]?.id || '')
  const [form, setForm] = useState({
    lecture_no: '', question: '', options: ['', '', '', ''], correct_index: 0, explanation: '',
  })
  const [bulk, setBulk] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const list = content.mcqs.filter((m) => m.subject_id === subjectId)

  async function saveOne(e) {
    e.preventDefault()
    if (!subjectId) return setMsg('Pick a subject first.')
    const item = {
      question: form.question,
      options: form.options,
      correct_index: Number(form.correct_index),
      lecture_no: form.lecture_no,
      explanation: form.explanation,
    }
    if (!validMcqItem(item)) {
      setMsg('Enter a question, four non-empty options, a valid correct option, and a valid lecture number.')
      return
    }
    const row = {
      subject_id: subjectId,
      lecture_no: form.lecture_no ? Number(form.lecture_no) : null,
      question: form.question.trim(),
      options: form.options.map((option) => option.trim()),
      correct_index: Number(form.correct_index),
      explanation: form.explanation.trim(),
    }
    const res = form.id
      ? await supabase.from('tp_mcqs').update(row).eq('id', form.id)
      : await supabase.from('tp_mcqs').insert(row)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg(form.id ? 'MCQ updated.' : 'MCQ added.')
      setForm({ id: null, lecture_no: '', question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' })
      refresh()
    }
  }

  async function saveBulk() {
    if (!subjectId) return setMsg('Pick a subject first.')
    if (bulk.length > MAX_IMPORT_BYTES) return setMsg('JSON content is too large. Maximum size is 5 MB.')
    let arr
    try {
      arr = JSON.parse(bulk)
    } catch {
      return setMsg('Bulk text is not valid JSON.')
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return setMsg('Bulk JSON must be a non-empty array.')
    }
    if (arr.length > MAX_IMPORT_ROWS) {
      return setMsg(`Import is limited to ${MAX_IMPORT_ROWS} questions per batch.`)
    }
    if (!arr.every(validMcqItem)) {
      return setMsg('Every MCQ needs a question, four non-empty options, numeric correct_index 0–3, and a valid optional lecture_no.')
    }
    const rows = arr.map((item) => ({
      subject_id: subjectId,
      lecture_no: item.lecture_no === '' || item.lecture_no == null ? null : Number(item.lecture_no),
      question: item.question.trim(),
      options: item.options.map((option) => option.trim()),
      correct_index: item.correct_index,
      explanation: typeof item.explanation === 'string' ? item.explanation.trim() : '',
    }))
    const res = await supabase.from('tp_mcqs').insert(rows)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg(`${rows.length} MCQs added.`)
      setBulk('')
      refresh()
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this MCQ?')) return
    const res = await supabase.from('tp_mcqs').delete().eq('id', id)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('MCQ deleted.')
      refresh()
    }
  }

  return (
    <div>
      <Field label="Subject">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {content.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </Field>
      <form className="card" onSubmit={saveOne}>
        <h3>{form.id ? 'Edit MCQ' : 'Add one MCQ'} (LaTeX with $...$ works in every field)</h3>
        <Field label="Lecture no.">
          <input value={form.lecture_no} onChange={(e) => set('lecture_no', e.target.value)} />
        </Field>
        <Field label="Question">
          <textarea rows={3} value={form.question} onChange={(e) => set('question', e.target.value)} />
        </Field>
        {form.options.map((o, i) => (
          <Field key={i} label={`Option ${'ABCD'[i]}`}>
            <input
              value={o}
              onChange={(e) =>
                set('options', form.options.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
          </Field>
        ))}
        <Field label="Correct option">
          <select value={form.correct_index} onChange={(e) => set('correct_index', e.target.value)}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {'ABCD'[i]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Explanation">
          <textarea rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
        </Field>
        <button className="primary" type="submit">
          {form.id ? 'Save MCQ changes' : 'Add MCQ'}
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() => setForm({ id: null, lecture_no: '', question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' })}
          >
            Cancel edit
          </button>
        )}
      </form>
      <div className="card">
        <h3>Bulk add (paste a JSON array or upload a file)</h3>
        <p className="muted">
          Each item: {'{'}question, options (4 strings), correct_index (0–3),
          explanation, lecture_no{'}'}. LaTeX with $...$ is supported.
        </p>
        <JsonFileInput onText={setBulk} setMsg={setMsg} label="Or upload a JSON file (fills the box below)" />
        <textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="primary" onClick={saveBulk}>
          Add all
        </button>
      </div>
      <h3>Existing MCQs ({list.length})</h3>
      {list.map((m, i) => (
        <div key={m.id} className="card row">
          <div>
            <strong>Q{i + 1}.</strong> <Tex text={m.question} />{' '}
            <span className="muted">(Lecture {m.lecture_no})</span>
          </div>
          <div>
            <button
              onClick={() => setForm({
                id: m.id,
                lecture_no: m.lecture_no || '',
                question: m.question || '',
                options: Array.isArray(m.options) ? m.options : ['', '', '', ''],
                correct_index: m.correct_index ?? 0,
                explanation: m.explanation || '',
              })}
            >
              Edit
            </button>{' '}
            <button onClick={() => remove(m.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function SubjectiveTab({ content, refresh, setMsg }) {
  const [subjectId, setSubjectId] = useState(content.subjects[0]?.id || '')
  const [kind, setKind] = useState('short')
  const [form, setForm] = useState({ id: null, lecture_no: '', marks: 3, question: '', answer: '' })
  const [bulk, setBulk] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const table = kind === 'short' ? 'tp_short_questions' : 'tp_long_questions'
  const list = (kind === 'short' ? content.shorts : content.longs).filter(
    (q) => q.subject_id === subjectId,
  )

  async function save(e) {
    e.preventDefault()
    if (!subjectId) return setMsg('Pick a subject first.')
    if (!validText(form.question) || !validText(form.answer) || !validLectureNo(form.lecture_no)) {
      setMsg('Enter a question, model answer, and valid optional lecture number.')
      return
    }
    const marks = Number(form.marks)
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) {
      setMsg('Marks must be a positive whole number no greater than 1000.')
      return
    }
    const row = {
      subject_id: subjectId,
      lecture_no: form.lecture_no ? Number(form.lecture_no) : null,
      marks,
      question: form.question.trim(),
      answer: form.answer.trim(),
    }
    let res
    if (form.id) res = await supabase.from(table).update(row).eq('id', form.id)
    else res = await supabase.from(table).insert(row)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Question saved.')
      setForm({ id: null, lecture_no: '', marks: kind === 'short' ? 3 : 5, question: '', answer: '' })
      refresh()
    }
  }

  async function saveBulk() {
    if (!subjectId) return setMsg('Pick a subject first.')
    if (bulk.length > MAX_IMPORT_BYTES) return setMsg('JSON content is too large. Maximum size is 5 MB.')
    let arr
    try {
      arr = JSON.parse(bulk)
    } catch {
      return setMsg('Bulk text is not valid JSON.')
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return setMsg('Bulk JSON must be a non-empty array.')
    }
    if (arr.length > MAX_IMPORT_ROWS) {
      return setMsg(`Import is limited to ${MAX_IMPORT_ROWS} questions per batch.`)
    }
    if (!arr.every(validSubjectiveItem)) {
      return setMsg('Every item needs a question, answer, valid optional lecture_no, and positive integer marks.')
    }
    const rows = arr.map((item) => ({
      subject_id: subjectId,
      lecture_no: item.lecture_no === '' || item.lecture_no == null ? null : Number(item.lecture_no),
      marks: item.marks ?? (kind === 'short' ? 3 : 5),
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    const res = await supabase.from(table).insert(rows)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg(`${rows.length} questions added.`)
      setBulk('')
      refresh()
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this question?')) return
    const res = await supabase.from(table).delete().eq('id', id)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Question deleted.')
      refresh()
    }
  }

  return (
    <div>
      <Field label="Subject">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {content.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="tabs">
        {['short', 'long'].map((k) => (
          <button
            key={k}
            className={kind === k ? 'primary' : ''}
            onClick={() => {
              setKind(k)
              setForm({ id: null, lecture_no: '', marks: k === 'short' ? 3 : 5, question: '', answer: '' })
            }}
          >
            {k === 'short' ? 'Short questions' : 'Long questions'}
          </button>
        ))}
      </div>
      <form className="card" onSubmit={save}>
        <h3>{form.id ? 'Edit' : 'Add'} {kind} question (LaTeX with $...$ works)</h3>
        <Field label="Lecture no.">
          <input value={form.lecture_no} onChange={(e) => set('lecture_no', e.target.value)} />
        </Field>
        <Field label="Marks">
          <input value={form.marks} onChange={(e) => set('marks', e.target.value)} />
        </Field>
        <Field label="Question">
          <textarea rows={3} value={form.question} onChange={(e) => set('question', e.target.value)} />
        </Field>
        <Field label="Model answer">
          <textarea rows={5} value={form.answer} onChange={(e) => set('answer', e.target.value)} />
        </Field>
        <button className="primary" type="submit">
          Save question
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() =>
              setForm({ id: null, lecture_no: '', marks: kind === 'short' ? 3 : 5, question: '', answer: '' })
            }
          >
            Cancel edit
          </button>
        )}
      </form>
      <div className="card">
        <h3>Bulk add {kind} questions (paste a JSON array or upload a file)</h3>
        <p className="muted">
          Each item: {'{'}question, answer, marks (optional), lecture_no
          (optional){'}'}. LaTeX with $...$ is supported.
        </p>
        <JsonFileInput onText={setBulk} setMsg={setMsg} label="Upload a JSON file (fills the box below)" />
        <textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="primary" onClick={saveBulk}>
          Add all
        </button>
      </div>
      <h3>
        Existing {kind} questions ({list.length})
      </h3>
      {list.map((q, i) => (
        <div key={q.id} className="card row">
          <div>
            <strong>Q{i + 1}.</strong> <Tex text={q.question} />{' '}
            <span className="muted">({q.marks} marks, Lecture {q.lecture_no})</span>
          </div>
          <div>
            <button
              onClick={() =>
                setForm({ id: q.id, lecture_no: q.lecture_no || '', marks: q.marks, question: q.question, answer: q.answer })
              }
            >
              Edit
            </button>{' '}
            <button onClick={() => remove(q.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminsTab({ setMsg }) {
  const [list, setList] = useState(null)
  const [missing, setMissing] = useState(false)
  const [email, setEmail] = useState('')

  async function load() {
    const res = await supabase
      .from('tp_admins')
      .select('email, created_at')
      .order('created_at')
    if (res.error) {
      setMissing(true)
      setList([])
    } else {
      setMissing(false)
      setList(res.data || [])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add(e) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setMsg('Enter a valid email address.')
    if (em === 'veducator4@gmail.com') return setMsg('The root admin already has access and cannot be added to this list.')
    const res = await supabase.from('tp_admins').insert({ email: em })
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Admin added.')
      setEmail('')
      load()
    }
  }

  async function remove(em) {
    if (!window.confirm(`Remove admin ${em}? They will lose admin access immediately.`)) return
    const res = await supabase.from('tp_admins').delete().eq('email', em)
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Admin removed.')
      load()
    }
  }

  if (missing) {
    return (
      <div className="card">
        <h3>Admins</h3>
        <p>
          The admins table is not set up yet. Run{' '}
          <code>supabase-tp-admins.sql</code> in the Supabase SQL editor first,
          then reload this page.
        </p>
      </div>
    )
  }

  return (
    <div>
      <form className="card" onSubmit={add}>
        <h3>Add admin</h3>
        <p className="muted">
          veducator4@gmail.com is the root admin and always has access; it is
          not listed here. Added admins can manage subjects, questions and
          settings, including this list.
        </p>
        <Field label="Admin email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <button className="primary" type="submit">
          Add admin
        </button>
      </form>
      <h3>Admins ({list === null ? '…' : list.length})</h3>
      {list === null ? (
        <p>Loading…</p>
      ) : list.length === 0 ? (
        <p className="card">No extra admins yet. Only the root admin has access.</p>
      ) : (
        list.map((a) => (
          <div key={a.email} className="card row">
            <div>
              <strong>{a.email}</strong>{' '}
              <span className="muted">
                {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
              </span>
            </div>
            <div>
              <button onClick={() => remove(a.email)}>Remove</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ProgressTab({ setMsg }) {
  const [profiles, setProfiles] = useState(null)
  const [attempts, setAttempts] = useState(null)
  const [open, setOpen] = useState(null)
  const [questions, setQuestions] = useState(null)
  const [adminMarks, setAdminMarks] = useState({})
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const [p, a] = await Promise.all([
      supabase.from('tp_profiles').select('id, email').order('email'),
      supabase.from('tp_attempts').select('*').order('created_at', { ascending: false }),
    ])
    if (!p.error) setProfiles(p.data || [])
    if (!a.error) setAttempts(a.data || [])
    if (p.error || a.error) {
      setMsg(`Could not load progress: ${p.error?.message || a.error?.message}`)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emailOf = (uid) =>
    (profiles || []).find((p) => p.id === uid)?.email ||
    `User ${String(uid).slice(0, 8)}…`

  async function openReview(attempt) {
    setOpen(attempt)
    setQuestions(null)
    setAdminMarks((attempt.review && attempt.review.marks) || {})
    setFeedback((attempt.review && attempt.review.feedback) || '')
    if (attempt.type === 'mcq') {
      const res = await supabase
        .from('tp_mcqs')
        .select('*')
        .eq('subject_id', attempt.subject_id)
        .order('lecture_no')
      setQuestions(res.error ? [] : res.data || [])
    } else {
      const [s, l] = await Promise.all([
        supabase.from('tp_short_questions').select('*').eq('subject_id', attempt.subject_id),
        supabase.from('tp_long_questions').select('*').eq('subject_id', attempt.subject_id),
      ])
      setQuestions([
        ...(s.data || []).map((q) => ({ ...q, kind: 'Short' })),
        ...(l.data || []).map((q) => ({ ...q, kind: 'Long' })),
      ])
    }
  }

  async function saveReviewPatch(patch) {
    const { data } = await supabase.auth.getUser()
    const res = await supabase
      .from('tp_attempts')
      .update({
        ...patch,
        review: {
          ...(open.review || {}),
          ...(patch.review || {}),
          reviewer: data?.user?.email || '',
          reviewed_at: new Date().toISOString(),
        },
      })
      .eq('id', open.id)
    if (res.error) {
      if (/column/i.test(res.error.message)) {
        setMsg(
          'Review columns are missing. Run supabase-tp-review.sql in the Supabase SQL editor first, then try again.',
        )
      } else {
        setMsg(`Error: ${res.error.message}`)
      }
      return false
    }
    return true
  }

  async function saveSubjectiveReview() {
    if (!open || !questions) return
    const marks = {}
    let total = 0
    for (const q of questions) {
      const max = q.marks == null ? 100 : q.marks
      const v = Number(adminMarks[q.id])
      if (!Number.isInteger(v) || v < 0 || v > max) {
        setMsg(`Marks for "${String(q.question).slice(0, 40)}…" must be a whole number from 0 to ${max}.`)
        return
      }
      marks[q.id] = v
      total += v
    }
    setSaving(true)
    const ok = await saveReviewPatch({
      status: 'reviewed',
      admin_score: total,
      review: { marks, feedback: feedback.trim() },
    })
    setSaving(false)
    if (ok) {
      setMsg('Review saved. The student will see your marks in Result & Stats.')
      setOpen(null)
      load()
    }
  }

  async function acknowledgeMcq() {
    setSaving(true)
    const ok = await saveReviewPatch({
      status: 'reviewed',
      admin_score: open.score,
      review: { feedback: feedback.trim() },
    })
    setSaving(false)
    if (ok) {
      setMsg('MCQ attempt marked as reviewed.')
      setOpen(null)
      load()
    }
  }

  if (profiles === null || attempts === null) return <p>Loading progress…</p>

  const byUser = {}
  attempts.forEach((a) => {
    if (!byUser[a.user_id]) byUser[a.user_id] = []
    byUser[a.user_id].push(a)
  })
  const userIds = [
    ...profiles.map((p) => p.id),
    ...Object.keys(byUser).filter((uid) => !profiles.some((p) => p.id === uid)),
  ]

  return (
    <div>
      {open && (
        <div className="card review-panel">
          <div className="mcq-between">
            <h3>
              Review: {emailOf(open.user_id)} — {open.subject_code} (
              {open.type === 'mcq' ? 'MCQ' : 'Subjective'})
            </h3>
            <button onClick={() => setOpen(null)}>Close</button>
          </div>
          <p className="muted">
            Submitted {new Date(open.created_at).toLocaleString()} · Student
            score: {open.score} / {open.total} · Status: {open.status || 'submitted'}
          </p>
          {questions === null && <p>Loading questions…</p>}
          {open.type === 'mcq' && questions && questions.length === 0 && (
            <p className="muted">
              Question details are unavailable (the subject may have changed).
              Auto score: {open.score} / {open.total}.
              {open.details && Array.isArray(open.details.wrong_lectures) && open.details.wrong_lectures.length > 0 && (
                <> Wrong lectures: {open.details.wrong_lectures.join(', ')}.</>
              )}
            </p>
          )}
          {open.type === 'mcq' &&
            questions &&
            questions.map((q) => {
              const mine = open.details?.answers?.[q.id]
              const right = mine === q.correct_index
              return (
                <div key={q.id} className="review-q">
                  <p>
                    <Tex text={q.question} />{' '}
                    <span className="muted">(Lecture {q.lecture_no})</span>
                  </p>
                  <p>
                    Student answer:{' '}
                    <strong>
                      {mine === undefined
                        ? 'not answered'
                        : `${'ABCD'[mine]}. `}
                      {mine !== undefined && <Tex text={q.options[mine]} />}
                    </strong>{' '}
                    <span className={right ? 'ok-text' : 'bad-text'}>
                      {mine === undefined ? '' : right ? '✓ correct' : '✗ wrong'}
                    </span>
                  </p>
                  {!right && (
                    <p className="muted">
                      Correct answer: {'ABCD'[q.correct_index]}.{' '}
                      <Tex text={q.options[q.correct_index]} />
                    </p>
                  )}
                </div>
              )
            })}
          {open.type !== 'mcq' &&
            questions &&
            questions.map((q) => {
              const written = open.details?.written?.[q.id] || ''
              const plain = String(written)
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim()
              return (
                <div key={q.id} className="review-q">
                  <p>
                    <strong>
                      {q.kind} ({q.marks} marks). <Tex text={q.question} />
                    </strong>
                  </p>
                  <div className="review-answer">
                    {plain ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(written) }}
                      />
                    ) : (
                      <span className="muted">(no answer written)</span>
                    )}
                  </div>
                  <p className="muted">
                    Model answer: <Tex text={q.answer} />
                  </p>
                  <p>
                    Self-mark: <strong>{open.details?.marks?.[q.id] || 'not marked'}</strong>
                    {' · '}
                    <label className="admin-marks">
                      Teacher marks (0–{q.marks == null ? 100 : q.marks}):{' '}
                      <input
                        type="number"
                        min={0}
                        max={q.marks == null ? 100 : q.marks}
                        value={adminMarks[q.id] ?? ''}
                        onChange={(e) =>
                          setAdminMarks((m) => ({ ...m, [q.id]: e.target.value }))
                        }
                      />
                    </label>
                  </p>
                </div>
              )
            })}
          <Field label="Feedback for the student (optional)">
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          {open.type === 'mcq' ? (
            <button className="primary" disabled={saving} onClick={acknowledgeMcq}>
              {saving ? 'Saving…' : 'Mark MCQ attempt as reviewed'}
            </button>
          ) : (
            <button className="primary" disabled={saving} onClick={saveSubjectiveReview}>
              {saving ? 'Saving…' : 'Save teacher marks'}
            </button>
          )}
          <p className="muted">
            MCQ results are auto-graded and visible here instantly. Subjective
            marks you save here appear in the student&apos;s Result &amp; Stats.
          </p>
        </div>
      )}
      <h3>Student progress (per user)</h3>
      {userIds.length === 0 && <p className="card">No users yet.</p>}
      {userIds.map((uid) => {
        const list = byUser[uid] || []
        const reviewed = list.filter((a) => a.status === 'reviewed').length
        return (
          <div key={uid} className="card">
            <div className="mcq-between">
              <h3>{emailOf(uid)}</h3>
              <span className="muted">
                {list.length} attempt{list.length !== 1 ? 's' : ''} · {reviewed} reviewed
              </span>
            </div>
            {list.length === 0 ? (
              <p className="muted">No attempts yet.</p>
            ) : (
              list.map((a) => (
                <div key={a.id} className="attempt-row">
                  <div>
                    <strong>
                      {a.subject_code} — {a.type === 'mcq' ? 'MCQ' : 'Subjective'}
                    </strong>
                    <div className="muted">
                      {new Date(a.created_at).toLocaleString()} · Score: {a.score} / {a.total}
                      {a.status === 'reviewed' && a.admin_score != null && (
                        <> · Teacher: {a.admin_score} / {a.total}</>
                      )}
                    </div>
                  </div>
                  <div className="attempt-row-actions">
                    <span
                      className={`status-badge ${a.status === 'reviewed' ? 'reviewed' : 'pending'}`}
                    >
                      {a.status === 'reviewed' ? 'Reviewed' : 'Pending review'}
                    </span>
                    <button onClick={() => openReview(a)}>
                      {a.type === 'mcq' ? 'View result' : 'Review & mark'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

function SettingsTab({ setMsg }) {
  const [code, setCode] = useState('')
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    supabase
      .from('tp_settings')
      .select('value')
      .eq('key', 'access_code')
      .maybeSingle()
      .then(({ data }) => setCurrent(data ? data.value : ''))
  }, [])

  async function save(e) {
    e.preventDefault()
    const res = await supabase
      .from('tp_settings')
      .upsert({ key: 'access_code', value: code.trim() }, { onConflict: 'key' })
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('Access code saved. Share it only with students you want to allow in.')
      setCurrent(code.trim())
      setCode('')
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <h3>Student access code</h3>
      <p className="muted">
        Current code: <strong>{current === '' ? '(not set yet)' : current}</strong>
      </p>
      <p className="muted">
        Students must enter this code at signup. Without it, signup is refused.
        Change it any time; existing students stay signed in.
      </p>
      <Field label="New access code">
        <input value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <button className="primary" type="submit">
        Save access code
      </button>
    </form>
  )
}
