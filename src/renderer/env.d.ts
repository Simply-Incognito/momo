/// <reference types="vite/client" />

import type { BuddyApi } from '../preload/index'

declare global {
  interface Window {
    buddy: BuddyApi
  }
}

export {}
