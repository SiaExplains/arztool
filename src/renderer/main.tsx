import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { initI18n } from './i18n'
import { App } from './shell/App'
import { SettingsProvider } from './shell/SettingsProvider'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root missing')
const root = createRoot(container)

// Load settings before the first render so the UI never flashes in the wrong language.
void window.arztool.settings
  .get()
  .catch(() => DEFAULT_SETTINGS)
  .then((settings) => {
    initI18n(settings.language)
    root.render(
      <StrictMode>
        <SettingsProvider initial={settings}>
          <App />
        </SettingsProvider>
      </StrictMode>,
    )
  })
