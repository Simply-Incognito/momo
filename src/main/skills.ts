import { clipboard, Notification, shell } from 'electron'
import { spawn } from 'node:child_process'

export type SkillContext = {
  memory: {
    name: string
    preferences: Record<string, unknown>
    moodHistory: Array<{ mood: string; timestamp: number }>
    notes: Array<{ text: string; timestamp: number }>
    projects: string[]
    lastSeen: number | null
  }
  saveMemory: (next: SkillContext['memory']) => void
}

export type SkillResult = {
  ok: boolean
  spoken: string
  data?: unknown
}

/**
 * Small, local desktop skills. Each returns a short `spoken` line so the
 * character can say the result out loud.
 *
 * Adding a skill: add a case here, then call
 * `window.buddy.runSkill('your-skill', payload)` from the renderer.
 */
export async function handleSkill(skill: string, payload: unknown, ctx: SkillContext): Promise<SkillResult> {
  switch (skill) {
    case 'time': {
      const now = new Date()
      const spoken = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      return { ok: true, spoken: `It's ${spoken}.`, data: now.toISOString() }
    }

    case 'date': {
      const now = new Date()
      const spoken = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      return { ok: true, spoken: `Today is ${spoken}.` }
    }

    case 'open-website': {
      const url = typeof payload === 'string' ? payload : (payload as { url?: string })?.url
      if (!url || !/^https?:\/\//i.test(url)) {
        return { ok: false, spoken: "That doesn't look like a safe web address." }
      }
      await shell.openExternal(url)
      return { ok: true, spoken: 'Opening it now.' }
    }

    case 'open-app': {
      // Windows-first: `start` resolves via the shell. Other platforms use `open` / `xdg-open`.
      const target = typeof payload === 'string' ? payload : (payload as { target?: string })?.target
      if (!target) return { ok: false, spoken: 'Which app should I open?' }

      const [command, args] =
        process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '', target]]
          : process.platform === 'darwin'
            ? ['open', [target]]
            : ['xdg-open', [target]]

      spawn(command, args, { detached: true, stdio: 'ignore' }).unref()
      return { ok: true, spoken: 'Opening it.' }
    }

    case 'clipboard-read': {
      const text = clipboard.readText().trim()
      if (!text) return { ok: false, spoken: 'Your clipboard is empty.' }
      const preview = text.length > 280 ? `${text.slice(0, 280)}…` : text
      return { ok: true, spoken: preview, data: text }
    }

    case 'note': {
      const text = typeof payload === 'string' ? payload : (payload as { text?: string })?.text
      if (!text) return { ok: false, spoken: 'What should I write down?' }
      ctx.memory.notes.unshift({ text, timestamp: Date.now() })
      ctx.saveMemory(ctx.memory)
      return { ok: true, spoken: 'Noted.', data: ctx.memory.notes[0] }
    }

    case 'list-notes': {
      const notes = ctx.memory.notes.slice(0, 3)
      if (!notes.length) return { ok: true, spoken: "I don't have any notes yet." }
      return { ok: true, spoken: `You have ${ctx.memory.notes.length} notes. Latest: ${notes[0].text}`, data: notes }
    }

    case 'timer': {
      const raw = payload as { seconds?: number; label?: string }
      const seconds = Math.max(1, Math.min(60 * 60, Number(raw?.seconds) || 60))
      const label = raw?.label || 'timer'
      setTimeout(() => {
        new Notification({ title: 'momo', body: `Your ${label} is done.` }).show()
      }, seconds * 1000)
      const pretty = seconds >= 60 ? `${Math.round(seconds / 60)} minute${seconds >= 120 ? 's' : ''}` : `${seconds} seconds`
      return { ok: true, spoken: `Okay, ${pretty} timer started.` }
    }

    case 'weather': {
      return {
        ok: false,
        spoken: "I can't check the weather yet — that skill still needs a weather API key.",
      }
    }

    default:
      return { ok: false, spoken: `I don't know the "${skill}" skill yet.` }
  }
}
