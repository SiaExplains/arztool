import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initI18n } from './i18n'
import { App } from './shell/App'
import './styles.css'

initI18n()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
