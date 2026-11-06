// useMemory.ts
// Hook for local memory storage using IndexedDB
// Persists data across sessions

import { useState, useEffect } from 'react'

type Memory = {
  name: string
  preferences: Record<string, any>
  moodHistory: Array<{ mood: string; timestamp: number }>
  projects: string[]
  lastSeen: number
}

const STORAGE_KEY = 'buddy-memory'

export function useMemory() {
  const [memory, setMemory] = useState<Memory>(() => {
    // Check for persisted memory
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          return JSON.parse(stored)
        }
      } catch (e) {
        console.error('Failed to load memory', e)
      }
    }
    return {
      name: '',
      preferences: {},
      moodHistory: [],
      projects: [],
      lastSeen: Date.now(),
    }
  })

  useEffect(() => {
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
    } catch (e) {
      console.error('Failed to save memory', e)
    }
  }, [memory])

  // Update last seen timestamp
  const updateLastSeen = () => {
    setMemory(prev => ({ ...prev, lastSeen: Date.now() }))
  }

  // Add mood to history
  const addMood = (mood: string) => {
    setMemory(prev => ({
      ...prev,
      moodHistory: [
        ...prev.moodHistory,
        { mood, timestamp: Date.now() },
      ].slice(-20), // Keep last 20 mood entries
    }))
    updateLastSeen()
  }

  // Set name
  const setName = (name: string) => {
    setMemory(prev => ({ ...prev, name }))
    updateLastSeen()
  }

  // Set preference
  const setPreference = (key: string, value: any) => {
    setMemory(prev => ({ ...prev, preferences: { ...prev.preferences, [key]: value } }))
    updateLastSeen()
  }

  // Get preference
  const getPreference = (key: string, defaultValue: any = null) => {
    return memory.preferences[key] || defaultValue
  }

  // Add project
  const addProject = (project: string) => {
    setMemory(prev => ({
      ...prev,
      projects: [...new Set([...prev.projects, project])],
    }))
    updateLastSeen()
  }

  // Remove project
  const removeProject = (project: string) => {
    setMemory(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p !== project),
    }))
    updateLastSeen()
  }

  return {
    memory,
    setName,
    setPreference,
    getPreference,
    addMood,
    addProject,
    removeProject,
    updateLastSeen,
  }
}

export default useMemory