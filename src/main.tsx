import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initPlayerBridge } from './player/bridge'
import { initSession } from './player/session'
import './player/eq' // initialize + apply saved equalizer settings
import { useSettings } from './settings/store'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import './index.css'

initPlayerBridge()
initSession()
void useSettings.getState().load()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
