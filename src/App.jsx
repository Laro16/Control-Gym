import { useState, useEffect, useRef } from 'react'
import { supabase, signOut } from './supabase'
import Login from './components/Login'
import { AdminDashboard, UserDashboard } from './components/dashboard'

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

export default function App() {
  const [status, setStatus]   = useState('loading')
  const [profile, setProfile] = useState(null)
  const profileRef = useRef(null)
  const initDone   = useRef(false) // flag: carga inicial ya completada

  useEffect(() => {
    // ── CARGA INICIAL ──────────────────────────────────────
    // Usar getSession directamente — es síncrono con localStorage.
    // Esto resuelve el F5: no espera eventos, lee la sesión guardada.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      initDone.current = true
      if (!session?.user) {
        setStatus('login')
        return
      }
      const data = await fetchProfile(session.user.id)
      if (data) {
        profileRef.current = data
        setProfile(data)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    })

    // ── CAMBIOS POSTERIORES ───────────────────────────────
    // Solo manejar logout y nuevos logins DESPUÉS de que la carga inicial terminó.
    // Ignorar INITIAL_SESSION (ya lo manejó getSession arriba).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignorar hasta que la carga inicial esté lista
        if (!initDone.current) return

        if (event === 'SIGNED_OUT' || !session) {
          profileRef.current = null
          setProfile(null)
          setStatus('login')
          return
        }

        if (event === 'SIGNED_IN') {
          // Nuevo login — cargar perfil si es distinto usuario
          if (profileRef.current?.id === session.user.id) return
          const data = await fetchProfile(session.user.id)
          if (data) {
            profileRef.current = data
            setProfile(data)
            setStatus('ready')
          } else {
            setStatus('error')
          }
        }

        // TOKEN_REFRESHED, USER_UPDATED — no hacer nada si ya tenemos perfil
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    profileRef.current = null
    setProfile(null)
    setStatus('login')
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

  if (status === 'login') return <Login />

  if (status === 'error') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">
            No se pudo cargar tu perfil
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Tu sesión es válida pero el perfil no está disponible. Intenta de nuevo.
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
