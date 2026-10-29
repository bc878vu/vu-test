import { useMemo, useState } from 'react'
import { Tex, TruthTable } from './Tex.jsx'
import { saveAttempt } from './data.js'

const LETTERS = ['A', 'B', 'C', 'D']

export function McqTest({ user, subject, mcqs, onDone }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

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
      <h2>
        {subject.code} — MCQ Test ({mcqs.length} questions)
      </h2>
      {submitted && (
        <div className="result">
          Your score: {score} / {mcqs.length} ({Math.round((score / mcqs.length) * 100)}
          %)
          <div className="muted">{savedMsg}</div>
        </div>
      )}
      {mcqs.map((q, qi) => {
        const mine = answers[q.id]
        const correct = submitted && mine === q.correct_index
        const wrong = submitted && mine !== undefined && mine !== q.correct_index
        return (
          <div
            key={q.id}
            className={`card ${correct ? 'ok' : ''} ${wrong ? 'bad' : ''}`}
          >
            <p>
              <strong>
                Q{qi + 1}. <Tex text={q.question} />
              </strong>{' '}
              <span className="muted">Lecture {q.lecture_no}</span>
            </p>
            {q.options.map((opt, oi) => (
              <label key={oi} className="opt">
                <input
                  type="radio"
                  name={q.id}
                  checked={mine === oi}
                  disabled={submitted}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                />
                <span>
                  {LETTERS[oi]}. <Tex text={opt} />
                </span>
              </label>
            ))}
            {submitted && (
              <div className="review">
                <div>
                  Correct answer: {LETTERS[q.correct_index]}.{' '}
                  <Tex text={q.options[q.correct_index]} />
                </div>
                {q.explanation && (
                  <div className="muted">
                    <Tex text={q.explanation} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {!submitted && (
        <button className="primary" onClick={submit}>
          Submit test
        </button>
      )}
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

  return (
    <div>
      <button className="link" onClick={onDone}>
        ← Back to subjects
      </button>
      <h2>
        {subject.code} — Subjective Test ({all.length} questions)
      </h2>
      <p className="muted">
        Write your answer, then reveal the model answer and mark yourself
        honestly: right, partial, or wrong.
      </p>
      {submitted && counts && (
        <div className="result">
          Self-marked: {counts.right} right, {counts.partial} partial,{' '}
          {counts.wrong} wrong (out of {all.length})
          <div className="muted">{savedMsg}</div>
        </div>
      )}
      {all.map((q, qi) => (
        <div key={q.id} className="card">
          <p>
            <strong>
              Q{qi + 1} ({q.kind}, {q.marks} marks). <Tex text={q.question} />
            </strong>{' '}
            <span className="muted">Lecture {q.lecture_no}</span>
          </p>
          <textarea
            rows={4}
            placeholder="Write your answer here…"
            value={written[q.id] || ''}
            disabled={submitted}
            onChange={(e) => setWritten((w) => ({ ...w, [q.id]: e.target.value }))}
          />
          {!revealed[q.id] ? (
            <button onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}>
              Show model answer
            </button>
          ) : (
            <div className="model">
              <strong>Model answer:</strong>{' '}
              <Tex text={q.answer} />
              {q.table && <TruthTable table={q.table} />}
            </div>
          )}
          {revealed[q.id] && !submitted && (
            <div className="marks">
              <span>Self-mark: </span>
              {['right', 'partial', 'wrong'].map((m) => (
                <button
                  key={m}
                  className={marks[q.id] === m ? 'primary' : ''}
                  onClick={() => setMarks((x) => ({ ...x, [q.id]: m }))}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {!submitted && (
        <button className="primary" onClick={submit}>
          Submit test
        </button>
      )}
      {submitted && <button onClick={onDone}>Back to subjects</button>}
    </div>
  )
}
