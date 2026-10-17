import { useEffect } from 'react'
import { useUser } from './components/useUser'
import Login from './components/Login'
import Page from './pages/Page'
import Download from './pages/Download'
import CookieConsent from './components/CookieConsent'
import LoadingScreen from './components/LoadingScreen'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  loadoutPath,
  paramToTeam,
  slugToCategory,
  teamToParam,
} from './lib/weaponDisplay'
import './App.css'

const TEAM_STORAGE_KEY = 'wp_last_team'
const CAT_STORAGE_KEY = 'wp_last_category'

function rememberTeam(team) {
  try {
    if (team) localStorage.setItem(TEAM_STORAGE_KEY, team)
    else localStorage.removeItem(TEAM_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function rememberCategory(category) {
  try {
    if (category) localStorage.setItem(CAT_STORAGE_KEY, category)
  } catch {
    /* ignore */
  }
}

function readRememberedTeam() {
  try {
    const v = localStorage.getItem(TEAM_STORAGE_KEY)
    return v === 'T' || v === 'CT' ? v : null
  } catch {
    return null
  }
}

function readRememberedCategory() {
  try {
    return localStorage.getItem(CAT_STORAGE_KEY) || 'Rifle'
  } catch {
    return 'Rifle'
  }
}

function LoggedInRoutes({ user }) {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/team" element={<TeamRoute user={user} />} />
      <Route path="/:teamParam" element={<LoadoutRoute user={user} />} />
      <Route path="/:teamParam/:categorySlug" element={<LoadoutRoute user={user} />} />
      <Route path="*" element={<Navigate to="/team" replace />} />
    </Routes>
  )
}

function HomeRedirect() {
  const remembered = readRememberedTeam()
  if (remembered) {
    return <Navigate to={loadoutPath(remembered, readRememberedCategory())} replace />
  }
  return <Navigate to="/team" replace />
}

function TeamRoute({ user }) {
  const navigate = useNavigate()

  const setTeam = (next) => {
    if (!next) {
      rememberTeam(null)
      navigate('/team')
      return
    }
    rememberTeam(next)
    navigate(loadoutPath(next, readRememberedCategory()))
  }

  return <Page user={user} team={null} setTeam={setTeam} category="Rifle" setCategory={() => {}} />
}

function LoadoutRoute({ user }) {
  const navigate = useNavigate()
  const { teamParam, categorySlug } = useParams()
  const team = paramToTeam(teamParam)
  const category = slugToCategory(categorySlug)

  useEffect(() => {
    if (!team || !categorySlug) return
    rememberTeam(team)
    rememberCategory(category)
  }, [team, category, categorySlug])

  if (!team) {
    return <Navigate to="/team" replace />
  }

  const canonical = loadoutPath(team, category)
  const current = categorySlug
    ? `/${teamToParam(team)}/${categorySlug}`
    : `/${teamToParam(team)}`

  // Normalize /t → /t/rifle (or last category)
  if (!categorySlug) {
    return <Navigate to={loadoutPath(team, readRememberedCategory())} replace />
  }

  if (current.toLowerCase() !== canonical.toLowerCase()) {
    return <Navigate to={canonical} replace />
  }

  const setTeam = (next) => {
    if (!next) {
      rememberTeam(null)
      navigate('/team')
      return
    }
    rememberTeam(next)
    navigate(loadoutPath(next, category))
  }

  const setCategory = (nextCat) => {
    rememberCategory(nextCat)
    navigate(loadoutPath(team, nextCat))
  }

  return (
    <Page
      user={user}
      team={team}
      setTeam={setTeam}
      category={category}
      setCategory={setCategory}
    />
  )
}

function SessionApp() {
  const { user, loading, error } = useUser()

  if (error) return <main className="ch-connection-error"><h1>CloudHub CS2</h1><p>Nie można połączyć się z aplikacją / Unable to connect.</p><button className="ch-primary" onClick={() => window.location.reload()}>Spróbuj ponownie / Retry</button></main>

  if (loading) {
    return (
      <>
        <LoadingScreen />
        <CookieConsent />
      </>
    )
  }

  return (
      <div className="app-root">
        {user ? <LoggedInRoutes user={user} /> : <Login />}
        <CookieConsent />
      </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/download" element={<Download />} />
        <Route path="*" element={<SessionApp />} />
      </Routes>
    </BrowserRouter>
  )
}
