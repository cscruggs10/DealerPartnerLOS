import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Show error page if Clerk key is missing
if (!PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')!).render(
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#dc2626' }}>Configuration Error</h1>
      <p>Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.</p>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Please add VITE_CLERK_PUBLISHABLE_KEY to your Railway environment variables and redeploy.
      </p>
    </div>
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
