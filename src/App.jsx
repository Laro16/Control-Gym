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
    let mounted = true

    const loadSessionAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          if (mounted) setStatus('login')
          return
        }

        const data = await fetchProfileWithRetry(session.user.id)
        if (!mounted) return

        if (data) {
          setProfile(data)
          setStatus('ready')
        } else {
          setStatus('error')
        }
      } catch (error) {
        if (mounted) setStatus('login')
      }
    }

    loadSessionAndProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null)
        setStatus('login')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setProfile((currentProfile) => {
          if (!currentProfile || currentProfile.id !== session.user.id) {
            loadSessionAndProfile()
          }
          return currentProfile
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Dependencia vacía: evita el ciclo infinito al recargar (F5)

  const handleLogout = async () => {
    await signOut()
  }

  // ── RENDER ────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-[#FDFCF8] dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-gray-800 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (status === 'login') return <Login />

  if (status === 'error') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">Error al cargar perfil</h2>
          <button onClick={handleLogout} className="btn-secondary w-full">Cerrar sesión e intentar de nuevo</button>
        </div>
      </div>
    )
  }

  if (status === 'ready' && profile) {
    if (profile.role === 'admin') return <AdminDashboard profile={profile} onLogout={handleLogout} />
    return <UserDashboard profile={profile} onLogout={handleLogout} />
  }

  return null
}
