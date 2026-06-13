import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './providers/AppProviders'
import { App } from './App.tsx'
import { migrateV1ToV2 } from './data/storage'
import './styles.css'

await migrateV1ToV2()

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)