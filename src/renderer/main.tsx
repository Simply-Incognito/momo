import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import './styles/main.css'

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Set reduced motion class on html element
if (prefersReducedMotion.matches) {
  document.documentElement.classList.add('reduced-motion')
}

prefersReducedMotion.addEventListener('change', (e) => {
  if (e.matches) {
    document.documentElement.classList.add('reduced-motion')
  } else {
    document.documentElement.classList.remove('reduced-motion')
  }
})

// Initialize Electron API reference
const electronAPI: any = (window as any).electronAPI

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App 
      electronAPI={electronAPI} 
      onStateChange={(state) => console.log('Character state:', state)}
    />
  </React.StrictMode>
)