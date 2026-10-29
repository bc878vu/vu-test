import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

// Word-like rich text editor (bold, italic, underline, headings, lists,
// alignment, links) for writing subjective answers. Stores HTML.
// Images/video are intentionally left out: they would need file storage.
const TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [1, 2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ align: [] }, { align: 'center' }, { align: 'right' }, { align: 'justify' }],
  ['link', 'clean'],
]

export default function RichEditor({ value, onChange, placeholder, disabled }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const lastHtmlRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const quill = new Quill(container, {
      theme: 'snow',
      placeholder: placeholder || 'Write your answer here…',
      modules: { toolbar: TOOLBAR },
    })
    quillRef.current = quill
    if (value) quill.clipboard.dangerouslyPasteHTML(value)
    lastHtmlRef.current = quill.root.innerHTML
    const handler = () => {
      const html = quill.getText().trim() === '' ? '' : quill.root.innerHTML
      if (html !== lastHtmlRef.current) {
        lastHtmlRef.current = html
        onChangeRef.current(html)
      }
    }
    quill.on('text-change', handler)
    return () => {
      quill.off('text-change', handler)
      quillRef.current = null
      container.innerHTML = ''
    }
    // Create once per mount; value/disabled handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    const next = value || ''
    const current = quill.getText().trim() === '' ? '' : quill.root.innerHTML
    if (next !== current) {
      const sel = quill.getSelection()
      quill.clipboard.dangerouslyPasteHTML(next)
      lastHtmlRef.current = quill.root.innerHTML
      if (sel) quill.setSelection(sel)
    }
  }, [value])

  useEffect(() => {
    if (quillRef.current) quillRef.current.enable(!disabled)
  }, [disabled])

  return <div className="rich-editor" ref={containerRef} />
}
