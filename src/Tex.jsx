import katex from 'katex'
import 'katex/dist/katex.min.css'

// Renders text with $...$ LaTeX segments via KaTeX. Plain text passes through.
// Truth tables are NOT prose here: see TruthTable below.
export function Tex({ text }) {
  if (text === null || text === undefined) return null
  const parts = String(text).split(/(\$[^$]+\$)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith('$') && part.endsWith('$')) {
          let html = ''
          try {
            html = katex.renderToString(part.slice(1, -1), { throwOnError: false })
          } catch {
            html = ''
          }
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// Real HTML table for truth tables (headers/rows may contain $...$ LaTeX).
export function TruthTable({ table }) {
  if (!table || !table.headers) return null
  return (
    <table className="truth-table">
      <thead>
        <tr>
          {table.headers.map((h, i) => (
            <th key={i}>
              <Tex text={h} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c}>
                <Tex text={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
