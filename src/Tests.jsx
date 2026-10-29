import { useEffect, useMemo, useState } from 'react'
import { Tex, TruthTable } from './Tex.jsx'
import { saveAttempt } from './data.js'
import RichEditor from './RichEditor.jsx'

const LETTERS = ['A', 'B', 'C', 'D']

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return undefined
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  return elapsed
}

function scrollToQuestion(index) {
  document
    .getElementById(`exam-q-${index + 1}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function McqTest({ user, subject, mcqs, onDone }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const elapsed = useElapsed(!submitted)
  const answered = Object.keys(answers).length
  const [current, setCurrent] = useState(0)
  const [bookmarked, setBookmarked] = useState({})
  const [showExplanation, setShowExplanation] = useState(false)
  const currentQ = mcqs[Math.min(current, mcqs.length - 1)]

  const score = useMemo(() => {
    if (!submitted) return null
    return mcqs.reduce(
      (n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0),
      0,
    )
  }, [submitted, answers, mcqs])

  async function submit() {
    const unanswered = mcqs.filter((q) => answers[q.id] === undefined).length
    if (unanswered > 0) {
      const ok = window.confirm(
        `${unanswered} question(s) are unanswered and will count as wrong. Submit anyway?`,
      )
      if (!ok) return
    }
    const sc = mcqs.reduce(
      (n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0),
      0,
    )
    const wrongLectures = mcqs
      .filter((q) => answers[q.id] !== q.correct_index)
      .map((q) => q.lecture_no)
      .filter((n) => n !== null && n !== undefined)
    setSubmitted(true)
    const res = await saveAttempt({
      userId: user.id,
      subject,
      type: 'mcq',
      score: sc,
      total: mcqs.length,
      details: { wrong_lectures: wrongLectures, answers },
    })
    setSavedMsg(res.ok ? 'Attempt saved to your progress.' : 'Result shown (could not save attempt).')
  }

  if (mcqs.length === 0) {
    return (
      <div className="card">
        <p>No MCQs for this subject yet.</p>
        <button onClick={onDone}>Back</button>
      </div>
    )
  }

  return (
    <div>
      <button className="link" onClick={onDone}>
        ← Back to subjects
      </button>
      {!submitted && (
      <div className="exam-bar">
        <div className="mcq-engine-head">
          <div>
            <span className="mcq-eyebrow">EduNexus MCQ Engine</span>
            <h2>
              {subject.code} — {subject.name}
            </h2>
          </div>
          <span className="mcq-count">
            {current + 1} of {mcqs.length}
          </span>
        </div>
        <div className="exam-meta">
          <span>
            {answered} / {mcqs.length} answered
          </span>
          <span className="exam-timer">⏱ {fmtTime(elapsed)}</span>
        </div>
        <div className="exam-progress">
          <div
            className="exam-progress-fill"
            style={{ width: `${mcqs.length ? Math.round((answered / mcqs.length) * 100) : 0}%` }}
          />
        </div>
        <div className="palette">
          {mcqs.map((q, qi) => {
            const mine = answers[q.id]
            let cls = 'palette-btn'
            if (submitted && mine === q.correct_index) cls += ' palette-right'
            else if (submitted && mine !== undefined) cls += ' palette-wrong'
            else if (qi === current) cls += ' palette-current'
            else if (mine !== undefined) cls += ' palette-done'
            else if (bookmarked[qi]) cls += ' palette-marked'
            return (
              <button
                key={q.id}
                type="button"
                className={cls}
                onClick={() => {
                  setCurrent(qi)
                  setShowExplanation(false)
                }}
              >
                {qi + 1}
              </button>
            )
          })}
        </div>
      </div>
      )}
      {submitted && (
        <div className="result score-card">
          <div className="score-big">
            {score} / {mcqs.length}
          </div>
          <div>{Math.round((score / mcqs.length) * 100)}% correct</div>
          <div className="muted">{savedMsg}</div>
        </div>
      )}
      {!submitted && (
        <section className="card mcq-play" aria-label={`Question ${current + 1}`}>
          <div className="mcq-between">
            <span className="mcq-qbadge">Question #{current + 1}</span>
            <button
              type="button"
              className={`mark-btn${bookmarked[current] ? ' active' : ''}`}
              onClick={() =>
                setBookmarked((b) => ({ ...b, [current]: !b[current] }))
              }
              title="Bookmark question"
            >
              {bookmarked[current] ? '★ Bookmarked' : '☆ Mark'}
            </button>
          </div>
          <div className="mcq-progress">
            <span style={{ width: `${((current + 1) / mcqs.length) * 100}%` }} />
          </div>
          <h3>
            <Tex text={currentQ.question} />
          </h3>
          <p className="muted">Lecture {currentQ.lecture_no}</p>
          <div className="mcq-options">
            {currentQ.options.map((opt, oi) => {
              const mine = answers[currentQ.id]
              const answeredQ = mine !== undefined
              let cls = 'mcq-option'
              if (answeredQ && oi === currentQ.correct_index) cls += ' correct'
              else if (answeredQ && oi === mine) cls += ' incorrect'
              return (
                <button
                  key={oi}
                  type="button"
                  disabled={answeredQ}
                  className={cls}
                  onClick={() => setAnswers((a) => ({ ...a, [currentQ.id]: oi }))}
                >
                  <span className="mcq-letter">{LETTERS[oi]}</span>
                  <span className="mcq-opt-text">
                    <Tex text={opt} />
                  </span>
                </button>
              )
            })}
          </div>
          {answers[currentQ.id] !== undefined && (
            <p
              className={`mcq-feedback ${
                answers[currentQ.id] === currentQ.correct_index ? 'is-right' : 'is-wrong'
              }`}
              role="status"
            >
              {answers[currentQ.id] === currentQ.correct_index ? (
                '✓ Correct!'
              ) : (
                <>
                  ✗ Incorrect. Correct answer: {LETTERS[currentQ.correct_index]} —{' '}
                  <Tex text={currentQ.options[currentQ.correct_index]} />.
                </>
              )}
            </p>
          )}
          {answers[currentQ.id] !== undefined && currentQ.explanation && (
            <div className="mcq-explain-wrap">
              <button
                type="button"
                className="explain-toggle"
                onClick={() => setShowExplanation((v) => !v)}
              >
                {showExplanation
                  ? 'Hide Explanation ▲'
                  : '💡 Show Instant Explanation ▼'}
              </button>
              {showExplanation && (
                <div className="mcq-explain">
                  <strong>Explanation: </strong>
                  <Tex text={currentQ.explanation} />
                </div>
              )}
            </div>
          )}
          <div className="mcq-actions">
            <button
              type="button"
              onClick={() => {
                setCurrent((c) => Math.max(0, c - 1))
                setShowExplanation(false)
              }}
              disabled={current === 0}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setCurrent((c) => Math.min(mcqs.length - 1, c + 1))
                setShowExplanation(false)
              }}
              disabled={current === mcqs.length - 1}
            >
              Next →
            </button>
          </div>
          <button type="button" className="mcq-finish" onClick={submit}>
            Finish now · see my score
          </button>
        </section>
      )}
      {submitted &&
        mcqs.map((q, qi) => {
          const mine = answers[q.id]
          return (
            <div key={q.id} className="card mcq-review">
              <p>
                <strong>
                  Q{qi + 1}. <Tex text={q.question} />
                </strong>{' '}
                <span className="muted">Lecture {q.lecture_no}</span>
              </p>
              {q.options.map((opt, oi) => {
                let cls = 'mcq-review-opt'
                if (oi === q.correct_index) cls += ' correct'
                else if (oi === mine) cls += ' incorrect'
                return (
                  <div key={oi} className={cls}>
                    <span className="mcq-letter">{LETTERS[oi]}</span>
                    <span>
                      <Tex text={opt} />
                    </span>
                    {oi === q.correct_index && <span className="muted"> — correct</span>}
                    {oi === mine && oi !== q.correct_index && (
                      <span className="muted"> — your answer</span>
                    )}
                  </div>
                )
              })}
              {q.explanation && (
                <div className="muted">
                  <Tex text={q.explanation} />
                </div>
              )}
            </div>
          )
        })}
      {submitted && <button onClick={onDone}>Back to subjects</button>}
    </div>
  )
}

export function SubjTest({ user, subject, shorts, longs, onDone }) {
  const all = [
    ...shorts.map((q) => ({ ...q, kind: 'Short' })),
    ...longs.map((q) => ({ ...q, kind: 'Long' })),
  ]
  const [written, setWritten] = useState({})
  const [revealed, setRevealed] = useState({})
  const [marks, setMarks] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [active, setActive] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30 * 60)
  const plainText = (html) =>
    String(html || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  const writtenCount = all.filter((q) => plainText(written[q.id]) !== '').length

  useEffect(() => {
    if (submitted || timeLeft <= 0) return undefined
    const t = setInterval(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(t)
  }, [submitted, timeLeft])

  async function submit() {
    const unmarked = all.filter((q) => !marks[q.id]).length
    if (unmarked > 0) {
      const ok = window.confirm(
        `${unmarked} question(s) are not self-marked yet. Submit anyway?`,
      )
      if (!ok) return
    }
    const right = all.filter((q) => marks[q.id] === 'right').length
    setSubmitted(true)
    const res = await saveAttempt({
      userId: user.id,
      subject,
      type: 'subjective',
      score: right,
      total: all.length,
      details: { marks, written },
    })
    setSavedMsg(res.ok ? 'Attempt saved to your progress.' : 'Result shown (could not save attempt).')
  }

  if (all.length === 0) {
    return (
      <div className="card">
        <p>No subjective questions for this subject yet.</p>
        <button onClick={onDone}>Back</button>
      </div>
    )
  }

  const counts = submitted
    ? {
        right: all.filter((q) => marks[q.id] === 'right').length,
        partial: all.filter((q) => marks[q.id] === 'partial').length,
        wrong: all.filter((q) => marks[q.id] === 'wrong').length,
      }
    : null

  const currentQ = all[Math.min(active, all.length - 1)]
  const timeUp = timeLeft <= 0

  return (
    <div>
      <button className="link" onClick={onDone}>
        ← Back to subjects
      </button>
      {!submitted && (
        <div className="paper-chrome">
          <div>
            <span className="mcq-eyebrow">Virtual University Paper Exam</span>
            <h2>
              {subject.code} — {subject.name}
            </h2>
          </div>
          <div className="paper-chrome-actions">
            <span
              className={`countdown${timeLeft < 300 && !timeUp ? ' low' : ''}${timeUp ? ' up' : ''}`}
            >
              ⏱ {timeUp ? 'Time up' : `Time Left: ${fmtTime(timeLeft)}`}
            </span>
            <button type="button" className="paper-submit" onClick={submit}>
              Final Submit 🚀
            </button>
          </div>
        </div>
      )}
      {!submitted && timeUp && (
        <div className="result time-up">
          Time is up. Your answers are still here — submit now to save this
          attempt.
        </div>
      )}
      {submitted && counts && (
        <div className="result score-card">
          <div className="score-big">
            {counts.right} right · {counts.partial} partial · {counts.wrong} wrong
          </div>
          <div>out of {all.length} questions</div>
          <div className="muted">
            Submitted to admin for review — teacher marks will appear in Result
            &amp; Stats.
          </div>
          <div className="muted">{savedMsg}</div>
        </div>
      )}
      {!submitted && (
        <div className="paper-grid">
          <aside className="paper-side card">
            <p className="mcq-eyebrow">Subjective Questions</p>
            <div className="paper-side-list">
              {all.map((q, qi) => {
                const answeredQ = plainText(written[q.id]) !== ''
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`paper-side-btn${qi === active ? ' active' : ''}`}
                    onClick={() => setActive(qi)}
                  >
                    <span>
                      Q.{qi + 1} ({q.marks} Marks)
                    </span>
                    <span>{answeredQ ? '✅' : '⏳'}</span>
                  </button>
                )
              })}
            </div>
            <p className="muted">
              {writtenCount} / {all.length} written ·{' '}
              {Object.keys(marks).length} / {all.length} self-marked
            </p>
          </aside>
          <div className="paper-workspace">
            <div className="card paper-question">
              <div className="mcq-between">
                <span className="mcq-qbadge">Question #{active + 1}</span>
                <span className="muted">Marks: {currentQ.marks}</span>
              </div>
              <h3>
                <Tex text={currentQ.question} />
              </h3>
              <p className="muted">
                {currentQ.kind} · Lecture {currentQ.lecture_no}
              </p>
              <div className="editor-label">
                <span>MS Word-Like Rich Text Editor</span>
                <span>Supports Bold, Italic, Lists, Headings</span>
              </div>
              <RichEditor
                value={written[currentQ.id] || ''}
                onChange={(html) => setWritten((w) => ({ ...w, [currentQ.id]: html }))}
                placeholder="Write your answer here…"
                disabled={submitted}
              />
              {!revealed[currentQ.id] ? (
                <button
                  onClick={() => setRevealed((r) => ({ ...r, [currentQ.id]: true }))}
                >
                  Show model answer
                </button>
              ) : (
                <div className="model">
                  <strong>Model answer:</strong> <Tex text={currentQ.answer} />
                  {currentQ.table && <TruthTable table={currentQ.table} />}
                </div>
              )}
              {revealed[currentQ.id] && !submitted && (
                <div className="marks">
                  <span>Self-mark: </span>
                  {['right', 'partial', 'wrong'].map((m) => (
                    <button
                      key={m}
                      className={marks[currentQ.id] === m ? 'primary' : ''}
                      onClick={() => setMarks((x) => ({ ...x, [currentQ.id]: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <div className="mcq-actions">
                <button
                  type="button"
                  onClick={() => setActive((a) => Math.max(0, a - 1))}
                  disabled={active === 0}
                >
                  ← Previous Question
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setActive((a) => Math.min(all.length - 1, a + 1))}
                  disabled={active === all.length - 1}
                >
                  Next Question →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {submitted && (
        <div>
          {all.map((q, qi) => (
            <div key={q.id} className="card">
              <p>
                <strong>
                  Q{qi + 1} ({q.kind}, {q.marks} marks). <Tex text={q.question} />
                </strong>{' '}
                <span className="muted">Lecture {q.lecture_no}</span>
              </p>
              <p>
                Self-mark: <strong>{marks[q.id] || 'not marked'}</strong>
              </p>
              <div className="model">
                <strong>Model answer:</strong> <Tex text={q.answer} />
                {q.table && <TruthTable table={q.table} />}
              </div>
            </div>
          ))}
          <button onClick={onDone}>Back to subjects</button>
        </div>
      )}
    </div>
  )
}
