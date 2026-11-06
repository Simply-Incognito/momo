/**
 * Command layer for Buddy.
 *
 * This is intentionally local and deterministic: voice transcripts are parsed
 * here and routed to desktop skills. A streaming Claude conversation layer will
 * wrap this next, falling back to it for anything Claude cannot do directly.
 */

const WEBSITES: Record<string, string> = {
  youtube: 'https://youtube.com',
  google: 'https://google.com',
  github: 'https://github.com',
  gmail: 'https://mail.google.com',
  reddit: 'https://reddit.com',
  twitter: 'https://x.com',
  x: 'https://x.com',
  wikipedia: 'https://wikipedia.org',
  spotify: 'https://open.spotify.com',
  netflix: 'https://netflix.com',
  anthropic: 'https://console.anthropic.com',
}

const APPS: Record<string, string> = {
  'vs code': 'code',
  vscode: 'code',
  code: 'code',
  notepad: 'notepad',
  calculator: 'calc',
  calc: 'calc',
  paint: 'mspaint',
  explorer: 'explorer',
  files: 'explorer',
  terminal: 'wt',
  cmd: 'cmd',
  powershell: 'powershell',
  spotify: 'spotify',
  chrome: 'chrome',
  edge: 'msedge',
  firefox: 'firefox',
}

let cachedKey: string | null = null

async function hasApiKey(): Promise<boolean> {
  if (cachedKey) return true
  try {
    cachedKey = await window.buddy.getApiKey()
    return Boolean(cachedKey)
  } catch {
    return false
  }
}

const stripPunctuation = (text: string) => text.replace(/[.!?,;]+$/g, '').trim()

async function openSite(name: string): Promise<string> {
  const key = name.toLowerCase().trim()
  const url = WEBSITES[key] ?? (/^[\w-]+\.[a-z]{2,}$/i.test(key) ? `https://${key}` : null)
  if (!url) return `I don't know the site "${name}". Try a full address.`
  const result = await window.buddy.runSkill('open-website', { url })
  return result.ok ? `Opening ${key}.` : result.spoken
}

async function openApp(name: string): Promise<string> {
  const key = name.toLowerCase().trim()
  const target = APPS[key]
  if (!target) return `I don't know how to open "${name}" yet.`
  const result = await window.buddy.runSkill('open-app', { target })
  return result.ok ? `Opening ${key}.` : result.spoken
}

export async function replyTo(input: string): Promise<string> {
  const text = stripPunctuation(input)
  const lower = text.toLowerCase()

  if (!lower) return 'I’m listening.'

  if (/^(hi|hey|hello|yo|sup|good morning|good evening)\b/.test(lower)) {
    return 'Hey you. What are we working on?'
  }

  if (/^(thanks|thank you|thx)\b/.test(lower)) return 'Any time.'
  if (/^(stop|never mind|nevermind|cancel)\b/.test(lower)) return 'Okay.'

  if (/\b(what time|the time|time is it)\b/.test(lower)) {
    const result = await window.buddy.runSkill('time')
    return result.ok ? result.spoken : "I couldn't read the clock."
  }

  if (/\b(what.*(date|day)|what.s today)\b/.test(lower)) {
    const result = await window.buddy.runSkill('date')
    return result.ok ? result.spoken : "I couldn't read the calendar."
  }

  if (/\b(read (my )?clipboard|what.s (on|copied))\b/.test(lower)) {
    const result = await window.buddy.runSkill('clipboard-read')
    return result.ok ? result.spoken : 'Your clipboard is empty.'
  }

  const noteMatch = text.match(/(?:take a note|make a note|note that|remember that|remember)[:\s]+(.+)/i)
  if (noteMatch) {
    const note = noteMatch[1].trim()
    const result = await window.buddy.runSkill('note', { text: note })
    return result.ok ? `Noted: ${note}` : 'What should I write down?'
  }

  const timerMatch = lower.match(/(?:set (?:a )?timer for|timer for|remind me in)\s*(\d+)\s*(second|sec|minute|min|hour)/)
  if (timerMatch) {
    const amount = Number(timerMatch[1])
    const unit = timerMatch[2]
    const seconds = unit.startsWith('h') ? amount * 3600 : unit.startsWith('m') ? amount * 60 : amount
    const result = await window.buddy.runSkill('timer', { seconds, label: 'timer' })
    return result.spoken
  }

  const openMatch = lower.match(/^(?:open|launch|start|go to)\s+(.+)$/)
  if (openMatch) {
    const target = openMatch[1].trim()
    if (APPS[target]) return openApp(target)
    if (WEBSITES[target] || /^[\w-]+\.[a-z]{2,}$/i.test(target)) return openSite(target)
    // Default: try it as an app, the OS will refuse gracefully.
    return openApp(target)
  }

  if (/\b(what am i looking at|look at my screen|describe (my|the) screen)\b/.test(lower)) {
    return "Screen awareness isn't switched on yet. I'll ask before I ever look."
  }

  if (/\bweather\b/.test(lower)) {
    const result = await window.buddy.runSkill('weather')
    return result.spoken
  }

  if (/\b(what can you do|help me|your skills|commands)\b/.test(lower)) {
    return 'I can tell the time, open apps and sites, read your clipboard, take notes, and set timers. Ask me naturally.'
  }

  if (await hasApiKey()) {
    return "You've added an API key, but my Claude brain isn't connected yet — that's the next step."
  }

  return "I heard you, but I only understand simple commands right now. Try “open notepad” or “what time is it”."
}
