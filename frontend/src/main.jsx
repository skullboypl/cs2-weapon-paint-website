import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nProvider.jsx'
import { registerServiceWorker } from './lib/registerSW.js'
import AppDialogs from './components/AppDialogs.jsx'
import { loadSiteConfig } from './lib/siteConfig.js'

// Sync API cache_version early (clears FE TTL/ETag after dev restart / release)
loadSiteConfig()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <AppDialogs />
    </I18nProvider>
  </StrictMode>,
)

registerServiceWorker()
