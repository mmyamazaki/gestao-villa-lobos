import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import './index.css'
import App from './App.tsx'
import { SchoolProvider } from './state/SchoolContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SchoolProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SchoolProvider>
    </BrowserRouter>
  </StrictMode>,
)
