import { useCallback, useEffect, useState } from 'react'
import { supabase, isAdmin } from './supabaseClient'
import { loadContent, upsertProfile, fetchMyAttempts, readAccessCode } from './data.js'
import { McqTest, SubjTest } from './Tests.jsx'
import Admin from './Admin.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [content, setContent] = useState(null)
  const [view, setView] = useState({ name: 'subjects' })
  const [authMsg, setAuthMsg] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')

  const refresh = useCallback(async () => {
    const c = await loadContent()
    setContent(c)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
      setAuthLoading(false)
      if (data.session?.user) upsertProfile(data.session.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) upsertProfile(session.user)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleAuth(e) {
    e.preventDefault()
    setAuthMsg('')
    if (!supabase) return
    if (authMode === 'signup') {
      const { code, error } = await readAccessCode()
      if (error) return setAuthMsg(error)
      if (!code) {
        return setAuthMsg(
          'The access code has not been set yet. Ask the admin to set it in Settings first.',
        )
      }
      if (accessCode.trim() !== code) {
        return setAuthMsg('Wrong access code. Ask the admin for the current code.')
      }
      const { error: signErr } = await supabase.auth.signUp({ email, password })
      if (signErr) return setAuthMsg(signErr.message)
      setAuthMsg('Account created. You can now log in.')
      setAuthMode('login')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMsg(error.message)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setView({ name: 'subjects' })
  }

  if (!supabase) {
    return (
      <div className="shell">
        <header>
          <h1>VU Test Papers</h1>
        </header>
        <main>
          <div className="card">
            <h2>Setup needed</h2>
            <p>
              Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in a <code>.env</code> file
              (see <code>.env.example</code>), run <code>supabase-tp.sql</code>{' '}
              in the Supabase SQL editor, then reload.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (authLoading || !content) {
    return (
      <div className="shell">
        <header>
          <h1>VU Test Papers</h1>
        </header>
        <main>
          <p>Loading…</p>
        </main>
      </div>
    )
  }

  const admin = isAdmin(user)

  return (
    <div className="shell">
      <header>
        <h1>VU Test Papers</h1>
        <div className="nav">
          <button onClick={() => setView({ name: 'subjects' })}>Subjects</button>
          {user && <button onClick={() => setView({ name: 'progress' })}>My progress</button>}
          {admin && <button onClick={() => setView({ name: 'admin' })}>Admin</button>}
          {user ? (
            <button onClick={logout}>Logout ({user.email})</button>
          ) : (
            <button onClick={() => setView({ name: 'auth' })}>Login / Signup</button>
          )}
        </div>
      </header>
      <main>
        {content.fromSeed && (
          <div className="notice">
            Showing built-in seed content (PHY101, MTH202, STA301 midterm, lectures
            1–22). Admin edits and saved progress need the database: run{' '}
            <code>supabase-tp.sql</code> in the Supabase SQL editor.
          </div>
        )}
        {!user && view.name !== 'auth' && (
          <div className="card">
            <h2>Login required</h2>
            <p>
              Only students with an access code can take tests here. Log in, or
              sign up with the access code given by the admin.
            </p>
            <button className="primary" onClick={() => setView({ name: 'auth' })}>
              Login / Signup
            </button>
          </div>
        )}
        {view.name === 'auth' && !user && (
          <form className="card" onSubmit={handleAuth}>
            <h2>{authMode === 'login' ? 'Login' : 'Signup'}</h2>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {authMode === 'signup' && (
              <label className="field">
                <span>Access code (from the admin)</span>
                <input
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                />
              </label>
            )}
            {authMsg && <div className="result">{authMsg}</div>}
            <button className="primary" type="submit">
              {authMode === 'login' ? 'Login' : 'Create account'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login')
                setAuthMsg('')
              }}
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
            </button>
          </form>
        )}
        {user && view.name === 'subjects' && (
          <SubjectsList
            content={content}
            onTest={(kind, subject) => setView({ name: kind, subject })}
          />
        )}
        {user && view.name === 'mcq' && (
          <McqTest
            user={user}
            subject={view.subject}
            mcqs={content.mcqs.filter((m) => m.subject_id === view.subject.id)}
            onDone={() => {
              setView({ name: 'subjects' })
              refresh()
            }}
          />
        )}
        {user && view.name === 'subj' && (
          <SubjTest
            user={user}
            subject={view.subject}
            shorts={content.shorts.filter((q) => q.subject_id === view.subject.id)}
            longs={content.longs.filter((q) => q.subject_id === view.subject.id)}
            onDone={() => {
              setView({ name: 'subjects' })
              refresh()
            }}
          />
        )}
        {user && view.name === 'progress' && <Progress user={user} content={content} />}
        {user && view.name === 'admin' && admin && <Admin onReload={refresh} />}
        {user && view.name === 'admin' && !admin && (
          <p className="card">Only the admin account can open this page.</p>
        )}
      </main>
      <footer className="muted">
        Midterm practice, lectures 1–22 only. “Most important / repeated” means the
        questions are present in past-paper banks and core to the handout; no
        per-question past-paper frequency is claimed.
      </footer>
    </div>
  )
}

function SubjectsList({ content, onTest }) {
  return (
    <div>
      <h2>Subjects</h2>
      {content.subjects.map((s) => {
        const nMcq = content.mcqs.filter((m) => m.subject_id === s.id).length
        const nShort = content.shorts.filter((q) => q.subject_id === s.id).length
        const nLong = content.longs.filter((q) => q.subject_id === s.id).length
        return (
          <div key={s.id} className="card">
            <h3>
              {s.code} — {s.name}
            </h3>
            <p className="muted">
              {s.term} · {s.scope} · {nMcq} MCQs · {nShort} short · {nLong} long
              {s.code === 'STA301' && nLong === 0
                ? ' (no verified long section for this midterm)'
                : ''}
            </p>
            <button className="primary" onClick={() => onTest('mcq', s)}>
              MCQ test
            </button>{' '}
            <button onClick={() => onTest('subj', s)}>Subjective test</button>
          </div>
        )
      })}
    </div>
  )
}

function Progress({ user, content }) {
  const [attempts, setAttempts] = useState(null)

  useEffect(() => {
    fetchMyAttempts(user.id).then(setAttempts)
  }, [user.id])

  if (attempts === null) return <p>Loading progress…</p>
  if (attempts.length === 0) {
    return (
      <div className="card">
        <h2>My progress</h2>
        <p>No attempts yet. Take a test and it will appear here.</p>
      </div>
    )
  }

  // Weak topics: lectures with the most wrong MCQ answers.
  const weakCounts = {}
  attempts
    .filter((a) => a.type === 'mcq' && a.details && Array.isArray(a.details.wrong_lectures))
    .forEach((a) => {
      a.details.wrong_lectures.forEach((lec) => {
        weakCounts[lec] = (weakCounts[lec] || 0) + 1
      })
    })
  const weak = Object.entries(weakCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const bySubject = {}
  attempts.forEach((a) => {
    const key = a.subject_code || 'Unknown'
    if (!bySubject[key]) bySubject[key] = []
    bySubject[key].push(a)
  })

  return (
    <div>
      <h2>My progress</h2>
      {weak.length > 0 && (
        <div className="card">
          <h3>Weak topics (lectures with most wrong MCQ answers)</h3>
          <ul>
            {weak.map(([lec, n]) => (
              <li key={lec}>
                Lecture {lec}: {n} wrong answer{n > 1 ? 's' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Object.entries(bySubject).map(([code, list]) => {
        const mcq = list.filter((a) => a.type === 'mcq')
        const best = mcq.length
          ? Math.max(...mcq.map((a) => (a.total ? Math.round((a.score / a.total) * 100) : 0)))
          : null
        return (
          <div key={code} className="card">
            <h3>{code}</h3>
            <p className="muted">
              {list.length} attempt{list.length > 1 ? 's' : ''}
              {best !== null ? ` · best MCQ score ${best}%` : ''}
            </p>
            <ul>
              {list.slice(0, 10).map((a) => (
                <li key={a.id}>
                  {new Date(a.created_at).toLocaleString()} —{' '}
                  {a.type === 'mcq' ? 'MCQ' : 'Subjective'}: {a.score}/{a.total}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
