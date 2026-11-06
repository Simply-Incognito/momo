import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMemory } from '../hooks/useMemory'
import { useVoice } from '../hooks/useVoice'
import { replyTo } from '../services/brain'

type Tab = 'chat' | 'memory' | 'settings'
type Message = { role: 'user' | 'buddy'; text: string }

export default function Panel() {
  const [tab, setTab] = useState<Tab>('chat')
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('momo:theme') as 'light' | 'dark') || 'dark',
  )
  const [accent] = useState('#ff8fae')

  const { memory, update, save, clear } = useMemory()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'buddy', text: "Hey. I'm momo. What's up?" },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const voice = useVoice({
    onTranscript: (text) => send(text),
  })

  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [wakeWord, setWakeWord] = useState('Hey momo')
  const [hotkey, setHotkey] = useState('Ctrl+Space')
  const [startup, setStartup] = useState(false)
  const [savedFlash, setSavedFlash] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('momo:theme', theme)
  }, [theme])

  useEffect(() => {
    window.buddy.getApiKey().then((key) => setHasKey(Boolean(key)))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, tab])

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || busy) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setBusy(true)
    const reply = await replyTo(text)
    setMessages((prev) => [...prev, { role: 'buddy', text: reply }])
    setBusy(false)
  }

  const saveKey = async () => {
    if (!apiKey.trim()) return
    const ok = await window.buddy.saveApiKey(apiKey.trim())
    setHasKey(ok)
    setApiKey('')
    flash(ok ? 'API key saved securely' : "Couldn't save the key")
  }

  const flash = (text: string) => {
    setSavedFlash(text)
    window.setTimeout(() => setSavedFlash(''), 2200)
  }

  const toggleListening = () => {
    void voice.toggle()
  }

  return (
    <div className="panel" style={{ '--accent': accent } as CSSProperties}>
      <header className="panel__header">
        <div className="panel__brand">
          <span className="panel__dot" />
          momo
        </div>
        <div className="panel__actions">
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <button
            className="icon-btn"
            onClick={() => window.buddy.closePanel()}
            title="Close"
          >
            ✕
          </button>
        </div>
      </header>

      <nav className="panel__tabs">
        {(['chat', 'memory', 'settings'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`panel__tab ${tab === item ? 'is-active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === 'chat' && (
        <section className="panel__body">
          <div className="chat" ref={scrollRef}>
            {messages.map((message, index) => (
              <div key={index} className={`chat__row chat__row--${message.role}`}>
                <div className="chat__bubble">{message.text}</div>
              </div>
            ))}
            {busy && (
              <div className="chat__row chat__row--buddy">
                <div className="chat__bubble chat__typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {(voice.recording || voice.transcribing || voice.status || voice.transcript) && (
            <div className="chat__caption">
              {voice.status ||
                (voice.recording
                  ? 'listening…'
                  : voice.transcribing
                    ? 'working it out…'
                    : voice.transcript)}
            </div>
          )}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault()
              send()
            }}
          >
            <button
              type="button"
              className={`composer__mic ${voice.recording ? 'is-live' : ''}`}
              onClick={toggleListening}
              title="Push to talk"
            >
              {voice.recording ? '■' : '●'}
            </button>
            <input
              className="composer__input"
              value={input}
              placeholder="Say something…"
              onChange={(event) => setInput(event.target.value)}
            />
            <button className="composer__send" type="submit" disabled={!input.trim() || busy}>
              ↵
            </button>
          </form>
        </section>
      )}

      {tab === 'memory' && (
        <section className="panel__body panel__body--scroll">
          <label className="field">
            <span className="field__label">Your name</span>
            <input
              className="field__input"
              value={memory?.name ?? ''}
              placeholder="What should I call you?"
              onChange={(event) => update({ name: event.target.value })}
              onBlur={save}
            />
          </label>

          <div className="field">
            <span className="field__label">Notes ({memory?.notes.length ?? 0})</span>
            {memory?.notes.length ? (
              <ul className="notes">
                {memory.notes.map((note, index) => (
                  <li key={index} className="notes__item">
                    <span>{note.text}</span>
                    <time>{new Date(note.timestamp).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing saved yet. Say “take a note…”</p>
            )}
          </div>

          <div className="field">
            <span className="field__label">Mood history</span>
            <p className="muted">
              {memory?.moodHistory.length
                ? `${memory.moodHistory.length} moments recorded locally.`
                : 'No mood data yet.'}
            </p>
          </div>

          <button className="btn btn--danger" onClick={clear}>
            Delete all memory
          </button>
          <p className="hint">Memory lives on this device only.</p>
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel__body panel__body--scroll">
          <label className="field">
            <span className="field__label">Anthropic API key</span>
            <input
              className="field__input"
              type="password"
              value={apiKey}
              placeholder={hasKey ? '•••••••• saved' : 'sk-ant-…'}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <span className="hint">
              Stored locally with OS encryption. Get one at console.anthropic.com.
            </span>
          </label>
          <button className="btn" onClick={saveKey} disabled={!apiKey.trim()}>
            Save key
          </button>

          <label className="field">
            <span className="field__label">Wake word</span>
            <input
              className="field__input"
              value={wakeWord}
              onChange={(event) => setWakeWord(event.target.value)}
              onBlur={() => window.buddy.setWakeWord(wakeWord)}
            />
          </label>

          <label className="field">
            <span className="field__label">Push-to-talk hotkey</span>
            <input
              className="field__input"
              value={hotkey}
              onChange={(event) => setHotkey(event.target.value)}
              onBlur={() => window.buddy.setHotkey(hotkey)}
            />
          </label>

          <label className="field field--row">
            <span className="field__label">Start with Windows</span>
            <input
              type="checkbox"
              checked={startup}
              onChange={(event) => {
                setStartup(event.target.checked)
                window.buddy.setStartup(event.target.checked)
              }}
            />
          </label>

          <div className="field field--row">
            <span className="field__label">Theme</span>
            <button
              className="btn btn--ghost"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>

          <button className="btn btn--danger" onClick={() => window.buddy.quit()}>
            Quit momo
          </button>
          {savedFlash && <p className="hint hint--ok">{savedFlash}</p>}
        </section>
      )}
    </div>
  )
}
