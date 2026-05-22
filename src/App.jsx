import { useState, useEffect } from 'react'
import { supabase, getProfile, signOut } from './supabase'
import Login from './components/Login'
import { AdminDashboard, UserDashboard } from './components/dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const { data } = await getProfile(session.user.id)
        setProfile(data)
      }
      setLoading(false)
    })

    // Listener de cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) {
        const { data } = await getProfile(session.user.id)
        setProfile(data)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (user) => {
    const { data } = await getProfile(user.id)
    setProfile(data)
  }

  const handleLogout = async () => {
    await signOut()
    setSession(null)
    setProfile(null)
  }

  // Pantalla de carga inicial
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-gray-800 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // No autenticado → Login
  if (!session || !profile) {
    return <Login onLogin={handleLogin} />
  }

  // Admin → AdminDashboard
  if (profile.role === 'admin') {
    return <AdminDashboard profile={profile} onLogout={handleLogout} />
  }

  // Usuario → UserDashboard
  return <UserDashboard profile={profile} onLogout={handleLogout} />
}
