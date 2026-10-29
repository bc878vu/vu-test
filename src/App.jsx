import { useCallback, useEffect, useState } from 'react'
import { supabase, fetchIsAdmin } from './supabaseClient'
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
  const [admin, setAdmin] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('tp-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [activeSubject, setActiveSubject] = useState(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      window.localStorage.setItem('tp-theme', theme)
    } catch {
      // storage unavailable; theme still applies for this session
    }
  }, [theme])

  useEffect(() => {
    if (!activeSubject && content && content.subjects.length > 0) {
      setActiveSubject(content.subjects[0])
    }
  }, [content, activeSubject])

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

  useEffect(() => {
    if (!user) {
      setAdmin(false)
      return
    }
    let live = true
    fetchIsAdmin(user).then((v) => {
      if (live) setAdmin(v)
    })
    return () => {
      live = false
    }
  }, [user])

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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <div className="brand-logo">VU</div>
            <div>
              <h1>VU Test Papers</h1>
              <p className="tagline">Midterm practice · Lectures 1–22</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              title="Toggle dark mode"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {user && (
              <div className="user-badge">
                <div className="user-avatar">{user.email[0].toUpperCase()}</div>
                <div className="user-meta">
                  <span className="user-email">{user.email}</span>
                  <span className="user-role">{admin ? 'ADMIN' : 'STUDENT'}</span>
                </div>
              </div>
            )}
            {user ? (
              <button onClick={logout}>Logout</button>
            ) : (
              <button onClick={() => setView({ name: 'auth' })}>Login / Signup</button>
            )}
          </div>
        </div>
        <nav className="nav">
          <button
            className={view.name === 'subjects' ? 'nav-active' : ''}
            onClick={() => setView({ name: 'subjects' })}
          >
            🏠 Dashboard
          </button>
          <button
            className={view.name === 'mcq' ? 'nav-active' : ''}
            onClick={() => {
              if (activeSubject) setView({ name: 'mcq', subject: activeSubject })
              else setView({ name: 'subjects' })
            }}
          >
            ⚡ EduNexus MCQs
          </button>
          <button
            className={view.name === 'subj' ? 'nav-active' : ''}
            onClick={() => {
              if (activeSubject) setView({ name: 'subj', subject: activeSubject })
              else setView({ name: 'subjects' })
            }}
          >
            📝 Paper Exam
          </button>
          {admin && (
            <button
              className={view.name === 'admin' ? 'nav-active' : ''}
              onClick={() => setView({ name: 'admin' })}
            >
              ⚙️ Admin Panel
            </button>
          )}
          {user && (
            <button
              className={view.name === 'progress' ? 'nav-active' : ''}
              onClick={() => setView({ name: 'progress' })}
            >
              📊 Result & Stats
            </button>
          )}
        </nav>
      </header>
      <main>
        {!user && view.name !== 'auth' && (
          <div className="card welcome-card">
            <h2>Login required</h2>
            <p>
              Only students with an access code can take tests here. Log in, or
              sign up with the access code given by the admin.
            </p>
            <div className="actions">
              <button className="primary" onClick={() => setView({ name: 'auth' })}>
                Login / Signup
              </button>
            </div>
          </div>
        )}
        {view.name === 'auth' && !user && (
          <form className="card auth-card" onSubmit={handleAuth}>
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
            <div className="actions">
              <button className="primary" type="submit">
                {authMode === 'login' ? 'Login' : 'Create account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login')
                  setAuthMsg('')
                }}
              >
                {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
              </button>
            </div>
          </form>
        )}
        {user && view.name === 'subjects' && (
          <SubjectsList
            content={content}
            activeSubject={activeSubject}
            onSelect={setActiveSubject}
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
      <nav className="bottom-nav">
        <button
          className={view.name === 'subjects' ? 'active' : ''}
          onClick={() => setView({ name: 'subjects' })}
        >
          <span>🏠</span>
          <span>Home</span>
        </button>
        <button
          className={view.name === 'mcq' ? 'active' : ''}
          onClick={() => {
            if (activeSubject) setView({ name: 'mcq', subject: activeSubject })
            else setView({ name: 'subjects' })
          }}
        >
          <span>⚡</span>
          <span>MCQs</span>
        </button>
        <button
          className={view.name === 'subj' ? 'active' : ''}
          onClick={() => {
            if (activeSubject) setView({ name: 'subj', subject: activeSubject })
            else setView({ name: 'subjects' })
          }}
        >
          <span>📝</span>
          <span>Paper</span>
        </button>
        {admin && (
          <button
            className={view.name === 'admin' ? 'active' : ''}
            onClick={() => setView({ name: 'admin' })}
          >
            <span>⚙️</span>
            <span>Admin</span>
          </button>
        )}
        {user && (
          <button
            className={view.name === 'progress' ? 'active' : ''}
            onClick={() => setView({ name: 'progress' })}
          >
            <span>📊</span>
            <span>Stats</span>
          </button>
        )}
      </nav>
    </div>
  )
}

function SubjectsList({ content, activeSubject, onSelect, onTest }) {
  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow">✨ Virtual University Exam Suite</span>
          <h2>Modern Paper Exam &amp; EduNexus MCQs</h2>
          <p>
            Experience lightning-fast single-question MCQ testing with instant
            review mode and full MS Word-like formatting for subjective papers.
          </p>
          <div className="actions">
            <button
              className="primary"
              disabled={!activeSubject}
              onClick={() => activeSubject && onTest('mcq', activeSubject)}
            >
              Start EduNexus MCQ Test ⚡
            </button>
            <button
              className="hero-secondary"
              disabled={!activeSubject}
              onClick={() => activeSubject && onTest('subj', activeSubject)}
            >
              Take Subjective Exam 📝
            </button>
          </div>
          {activeSubject && (
            <p className="hero-active">
              Active subject: {activeSubject.code} — {activeSubject.name}
            </p>
          )}
        </div>
      </div>
      <h2>Select Active Course / Subject</h2>
      <div className="subjects-grid">
      {content.subjects.map((s) => {
        const nMcq = content.mcqs.filter((m) => m.subject_id === s.id).length
        const nShort = content.shorts.filter((q) => q.subject_id === s.id).length
        const nLong = content.longs.filter((q) => q.subject_id === s.id).length
        const selected = activeSubject && activeSubject.id === s.id
        return (
          <div
            key={s.id}
            className={`card subject-card${selected ? ' selected' : ''}`}
            onClick={() => onSelect(s)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelect(s)
            }}
          >
            <div className="subject-avatar">{s.code.slice(0, 3)}</div>
            <h3>
              {s.code} — {s.name}
            </h3>
            <p className="muted">
              {s.term} · {s.scope} · {nMcq} MCQs · {nShort} short · {nLong} long
              {s.code === 'STA301' && nLong === 0
                ? ' (no verified long section for this midterm)'
                : ''}
            </p>
            <div className="subject-foot">
              <span>{selected ? 'Selected ✓' : 'Select & Launch'}</span>
              <span>→</span>
            </div>
            <div className="actions">
              <button
                className="primary"
                onClick={(e) => {
                  e.stopPropagation()
                  onTest('mcq', s)
                }}
              >
                MCQ test
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTest('subj', s)
                }}
              >
                Subjective test
              </button>
            </div>
          </div>
        )
      })}
      </div>
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

  const scored = attempts.filter((a) => a.total > 0)
  const totalExams = attempts.length
  const avgPct = scored.length
    ? Math.round(
        (scored.reduce((n, a) => n + (a.score / a.total) * 100, 0) / scored.length) * 10,
      ) / 10
    : 0
  const bestPct = scored.length
    ? Math.max(...scored.map((a) => Math.round((a.score / a.total) * 100)))
    : 0

  return (
    <div>
      <div className="card stats-header">
        <div>
          <span className="mcq-eyebrow">Academic Performance</span>
          <h2>Student Exam History &amp; Stats</h2>
        </div>
        <span className="stats-pill">Saved attempts</span>
      </div>
      <div className="stat-grid">
        <div className="stat-card stat-indigo">
          <span className="stat-label">Total Exams Taken</span>
          <strong>{totalExams}</strong>
        </div>
        <div className="stat-card stat-violet">
          <span className="stat-label">Average Percentage</span>
          <strong>{scored.length ? `${avgPct}%` : '—'}</strong>
        </div>
        <div className="stat-card stat-emerald">
          <span className="stat-label">Best Score</span>
          <strong>{scored.length ? `${bestPct}%` : '—'}</strong>
        </div>
      </div>
      <div className="card">
        <h3>Recent Test Transcripts</h3>
        <div className="transcripts">
          {attempts.slice(0, 10).map((a) => (
            <div key={a.id} className="transcript-row">
              <div>
                <strong>
                  {a.subject_code || 'Unknown'} —{' '}
                  {a.type === 'mcq' ? 'MCQ Test' : 'Subjective Paper'}
                </strong>
                <div className="muted">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="transcript-score-block">
                <strong className="transcript-score">
                  {a.score} / {a.total}
                  {a.total > 0 ? ` (${Math.round((a.score / a.total) * 100)}%)` : ''}
                </strong>
                {a.status === 'reviewed' ? (
                  <div className="transcript-teacher">
                    Teacher: {a.admin_score ?? a.score} / {a.total}
                    {a.review?.feedback ? ` — ${a.review.feedback}` : ''}
                  </div>
                ) : a.type === 'mcq' ? (
                  <div className="muted">Auto-graded</div>
                ) : (
                  <div className="muted">Submitted to admin · pending review</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
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
