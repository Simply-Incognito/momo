/**
 * Placeholder "brain".
 *
 * This is deliberately small and local for now. The next milestone replaces
 * the fallback below with a streaming Anthropic Claude call in the main
 * process (API key stays in safeStorage, never in the renderer).
 */

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

export async function replyTo(input: string): Promise<string> {
  const text = input.trim()
  const lower = text.toLowerCase()

  if (/^(hi|hey|hello|yo|sup)\b/.test(lower)) {
    return 'Hey you. What are we working on?'
  }

  if (/\b(what time|the time|time is it)\b/.test(lower)) {
    const result = await window.buddy.runSkill('time')
    return result.ok ? result.spoken : "I couldn't read the clock."
  }

  if (/\b(read (my )?clipboard|what.s (on|copied))\b/.test(lower)) {
    const result = await window.buddy.runSkill('clipboard-read')
    return result.ok ? result.spoken : 'Your clipboard is empty.'
  }

  if (/\b(take a note|note that|make a note)\b/.test(lower)) {
    const note = text.replace(/^.*?(take a note|note that|make a note)[:\s]*/i, '').trim()
    const result = await window.buddy.runSkill('note', note)
    return result.ok ? 'Noted.' : 'What should I write down?'
  }

  if (/\b(set a timer|timer for)\b/.test(lower)) {
    const match = lower.match(/(\d+)\s*(minute|min|second|sec)/)
    const seconds = match
      ? Number(match[1]) * (match[2].startsWith('m') ? 60 : 1)
      : 60
    const result = await window.buddy.runSkill('timer', { seconds, label: 'timer' })
    return result.spoken
  }

  if (await hasApiKey()) {
    return "You've added an API key, but I'm not connected to Claude yet — that's the very next thing being built."
  }

  return "I heard you! My Claude brain isn't wired up yet. Add an API key in settings and I'll get much smarter."
}
