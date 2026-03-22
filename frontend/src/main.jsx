import React from 'react'
import { createRoot } from 'react-dom/client'
import { initializeAppStorage } from './storage'
import './styles.css'

await initializeAppStorage()

const { default: App } = await import('./App')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
