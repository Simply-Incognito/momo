import { useCallback, useEffect, useState } from 'react'

export type Memory = {
  name: string
  preferences: Record<string, unknown>
  moodHistory: Array<{ mood: string; timestamp: number }>
  notes: Array<{ text: string; timestamp: number }>
  projects: string[]
  lastSeen: number | null
}

const emptyMemory = (): Memory => ({
  name: '',
  preferences: {},
  moodHistory: [],
  notes: [],
  projects: [],
  lastSeen: null,
})

export function useMemory() {
  const [memory, setMemory] = useState<Memory | null>(null)

  useEffect(() => {
    let cancelled = false
    window.buddy.loadMemory().then((loaded) => {
      if (!cancelled) setMemory({ ...emptyMemory(), ...(loaded as Memory) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback((patch: Partial<Memory>) => {
    setMemory((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const save = useCallback(async () => {
    if (!memory) return
    await window.buddy.saveMemory({ ...memory, lastSeen: Date.now() })
  }, [memory])

  const clear = useCallback(async () => {
    const fresh = await window.buddy.clearMemory()
    setMemory({ ...emptyMemory(), ...(fresh as Memory) })
  }, [])

  return { memory, update, save, clear }
}
