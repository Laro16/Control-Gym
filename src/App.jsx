import { useState, useEffect } from 'react'
import { supabase, signOut } from './supabase'
import Login from './components/Login'
import { AdminDashboard, UserDashboard } from './components/dashboard'

async function fetchProfileWithRetry(userId, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) return data
    await new Promise(r => setTimeout(r, 1000))
  }
  return null
}

export default function App() {
  const [status, setStatus]   = useState('loading') // loading | login | ready | error
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Solo usamos onAuthStateChange como fuente única de verdad.
    // SIGNED_IN se dispara tanto al login como al recargar la página con sesión activa.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setProfile(null)
          setStatus('login')
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          setStatus('loading')
          const data = await fetchProfileWithRetry(session.user.id)
          if (data) {
            setProfile(data)
            setStatus('ready')
          } else {
            setStatus('error')
          }
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await signOut()
    // onAuthStateChange se encarga del resto
  }

  // ── RENDER ────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-gray-800 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (status === 'login') {
    return <Login />
  }

  if (status === 'error') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">
            No se pudo cargar tu perfil
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Tu sesión es válida pero el perfil no está en la base de datos.
            Ejecuta el SQL de reparación en Supabase o contacta al administrador.
          </p>
          <button onClick={handleLogout} className="btn-secondary w-full">
            Cerrar sesión e intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  if (status === 'ready' && profile) {
    if (profile.role === 'admin') {
      return <AdminDashboard profile={profile} onLogout={handleLogout} />
    }
    return <UserDashboard profile={profile} onLogout={handleLogout} />
  }

  return null
}
