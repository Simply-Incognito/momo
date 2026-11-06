import React from 'react'
import ReactDOM from 'react-dom/client'
import Buddy from './buddy/Buddy'
import Panel from './panel/Panel'
import './styles/main.css'

const view = new URLSearchParams(window.location.search).get('view')
document.body.dataset.view = view === 'panel' ? 'panel' : 'buddy'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>{view === 'panel' ? <Panel /> : <Buddy />}</React.StrictMode>,
)
