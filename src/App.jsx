import { useState, useEffect, useRef } from 'react'
import { supabase, signOut } from './supabase'
import Login from './components/Login'
import { CheckIn } from './components/CheckIn'
import { AdminDashboard, UserDashboard } from './components/dashboard'
import { Toaster } from './components/shared'

// Lee el código de check-in del hash: #checkin/CODIGO
function parseCheckin() {
  const m = (window.location.hash || '').match(/^#checkin\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

// ── SOUND HELPER ──────────────────────────────────────────
export function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.4)
  } catch {}
}

export function playAchievementSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784, 1047] // Do Mi Sol Do
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      o.type = 'sine'
      const t = ctx.currentTime + i * 0.12
      g.gain.setValueAtTime(0.3, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      o.start(t); o.stop(t + 0.3)
    })
  } catch {}
}

export default function App() {
  const [status, setStatus]   = useState('loading')
  const [profile, setProfile] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('gymapp-theme') !== 'light'
  })
  const [checkinCode, setCheckinCode] = useState(parseCheckin)
  const profileRef = useRef(null)
  const initDone   = useRef(false)

  // Detectar cambios en el hash (#checkin/CODIGO)
  useEffect(() => {
    const onHash = () => setCheckinCode(parseCheckin())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Aplicar tema al documento
  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode)
    localStorage.setItem('gymapp-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      initDone.current = true
      if (!session?.user) { setStatus('login'); return }
      const data = await fetchProfile(session.user.id)
      if (data) { profileRef.current = data; setProfile(data); setStatus('ready') }
      else setStatus('error')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initDone.current) return
        if (event === 'SIGNED_OUT' || !session) {
          profileRef.current = null; setProfile(null); setStatus('login'); return
        }
        if (event === 'SIGNED_IN') {
          if (profileRef.current?.id === session.user.id) return
          const data = await fetchProfile(session.user.id)
          if (data) { profileRef.current = data; setProfile(data); setStatus('ready') }
          else setStatus('error')
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    profileRef.current = null; setProfile(null); setStatus('login')
    await signOut()
  }

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

  // Check-in por QR: una vez resuelta la sesión, tiene prioridad.
  // Si no hay sesión, CheckIn muestra su propio login embebido.
  if (checkinCode) {
    return (
      <CheckIn
        code={checkinCode}
        profile={status === 'ready' ? profile : null}
        onExit={() => { window.location.hash = ''; setCheckinCode(null) }}
      />
    )
  }

  if (status === 'login') return <Login />

  if (status === 'error') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">No se pudo cargar tu perfil</h2>
          <p className="text-gray-400 text-sm mb-6">Tu sesión es válida pero el perfil no está disponible.</p>
          <button onClick={handleLogout} className="btn-secondary w-full">Cerrar sesión e intentar de nuevo</button>
        </div>
      </div>
    )
  }

  if (status === 'ready' && profile) {
    const isSuperAdmin =
      !!import.meta.env.VITE_SUPERADMIN_EMAIL &&
      profile.email?.toLowerCase() === import.meta.env.VITE_SUPERADMIN_EMAIL.toLowerCase()
    const props = { profile, onLogout: handleLogout, darkMode, onToggleDark: () => setDarkMode(d => !d) }
    if (profile.role === 'admin') return <><AdminDashboard {...props} isSuperAdmin={isSuperAdmin} /><Toaster /></>
    return <><UserDashboard {...props} /><Toaster /></>
  }

  return null
}
