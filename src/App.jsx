import { useState, useEffect } from 'react'
import { supabase, signOut } from './supabase'
import Login from './components/Login'
import { AdminDashboard, UserDashboard } from './components/dashboard'

async function fetchProfileWithRetry(userId, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) return data
    await new Promise(r => setTimeout(r, 800))
  }
  return null
}

export default function App() {
  const [status, setStatus]   = useState('loading') // loading | login | ready | error
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        // Cerró sesión → ir al login
        if (event === 'SIGNED_OUT' || !session) {
          setProfile(null)
          setStatus('login')
          return
        }

        // TOKEN_REFRESHED ocurre cuando vuelves a la pestaña.
        // Si ya tenemos el perfil cargado, NO hacemos nada.
        // Solo recargamos si realmente no hay perfil.
        if (event === 'TOKEN_REFRESHED') {
          setStatus(prev => {
            // Si ya estaba 'ready', lo dejamos así
            if (prev === 'ready') return 'ready'
            return prev
          })
          return
        }

        // INITIAL_SESSION o SIGNED_IN → cargar perfil
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          // Si ya tenemos perfil del mismo usuario, no volvemos a cargar
          if (profile?.id === session.user.id) {
            setStatus('ready')
            return
          }

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
  }, [profile]) // profile en dependencias para el check de mismo usuario

  const handleLogout = async () => {
    await signOut()
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
