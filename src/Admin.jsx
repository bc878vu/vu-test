import { useEffect, useState } from 'react'
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

function JsonFileInput({ onText, label }) {
  return (
    <Field label={label || 'Or upload a JSON file'}>
      <input
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files && e.target.files[0]
          if (f) onText(await f.text())
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
        {['subjects', 'mcqs', 'subjective', 'settings', 'admins'].map((t) => (
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
    if (!form.question.trim() || form.options.some((o) => !o.trim())) {
      setMsg('Question and all 4 options are required.')
      return
    }
    const res = await supabase.from('tp_mcqs').insert({
      subject_id: subjectId,
      lecture_no: form.lecture_no ? parseInt(form.lecture_no, 10) : null,
      question: form.question.trim(),
      options: form.options.map((o) => o.trim()),
      correct_index: parseInt(form.correct_index, 10),
      explanation: form.explanation.trim(),
    })
    if (res.error) setMsg('Error: ' + res.error.message)
    else {
      setMsg('MCQ added.')
      setForm({ lecture_no: '', question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' })
      refresh()
    }
  }

  async function saveBulk() {
    if (!subjectId) return setMsg('Pick a subject first.')
    let arr
    try {
      arr = JSON.parse(bulk)
    } catch {
      return setMsg('Bulk text is not valid JSON.')
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return setMsg('Bulk JSON must be a non-empty array.')
    }
    for (const item of arr) {
      if (
        !item.question ||
        !Array.isArray(item.options) ||
        item.options.length !== 4 ||
        item.correct_index === undefined ||
        item.correct_index < 0 ||
        item.correct_index > 3
      ) {
        return setMsg('Each bulk item needs question, exactly 4 options, and correct_index 0–3.')
      }
    }
    const rows = arr.map((item) => ({
      subject_id: subjectId,
      lecture_no: item.lecture_no || null,
      question: item.question,
      options: item.options,
      correct_index: item.correct_index,
      explanation: item.explanation || '',
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
        <h3>Add one MCQ (LaTeX with $...$ works in every field)</h3>
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
          Add MCQ
        </button>
      </form>
      <div className="card">
        <h3>Bulk add (paste a JSON array)</h3>
        <p className="muted">
          Each item: {'{'}question, options (4 strings), correct_index (0–3),
          explanation, lecture_no{'}'}. LaTeX with $...$ is supported.
        </p>
        <JsonFileInput onText={setBulk} label="Or upload a JSON file (fills the box below)" />
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
          <button onClick={() => remove(m.id)}>Delete</button>
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
    if (!form.question.trim() || !form.answer.trim()) {
      setMsg('Question and model answer are required.')
      return
    }
    const row = {
      subject_id: subjectId,
      lecture_no: form.lecture_no ? parseInt(form.lecture_no, 10) : null,
      marks: parseInt(form.marks, 10) || (kind === 'short' ? 3 : 5),
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
    let arr
    try {
      arr = JSON.parse(bulk)
    } catch {
      return setMsg('Bulk text is not valid JSON.')
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return setMsg('Bulk JSON must be a non-empty array.')
    }
    for (const item of arr) {
      if (!item.question || !item.answer) {
        return setMsg('Each bulk item needs question and answer.')
      }
    }
    const rows = arr.map((item) => ({
      subject_id: subjectId,
      lecture_no: item.lecture_no || null,
      marks: parseInt(item.marks, 10) || (kind === 'short' ? 3 : 5),
      question: item.question,
      answer: item.answer,
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
        <JsonFileInput onText={setBulk} label="Upload a JSON file (fills the box below)" />
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
    if (!em || !em.includes('@')) return setMsg('Enter a valid email address.')
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
