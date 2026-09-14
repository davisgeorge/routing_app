import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

// Checked BEFORE importing App/AuthContext (and transitively firebase/config.js):
// getAuth() throws synchronously on an invalid/missing API key, which would
// otherwise abort the whole render with a blank white screen and no clue why.
const hasFirebaseConfig = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
)

async function bootstrap() {
  const root = createRoot(document.getElementById('root'))
  const { ThemeProvider } = await import('./context/ThemeContext.jsx')

  if (!hasFirebaseConfig) {
    const { default: SetupRequired } = await import('./SetupRequired.jsx')
    root.render(
      <ThemeProvider>
        <SetupRequired />
      </ThemeProvider>,
    )
    return
  }

  const [{ default: App }, { AuthProvider }] = await Promise.all([
    import('./App.jsx'),
    import('./context/AuthContext.jsx'),
  ])

  root.render(
    <StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>,
  )
}

bootstrap()
