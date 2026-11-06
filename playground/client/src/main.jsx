import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './site/creative.css'
import App from './App.jsx'
import { SiteModeProvider } from './site/siteMode'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <SiteModeProvider>
        <App />
      </SiteModeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
