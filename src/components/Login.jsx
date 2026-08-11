import { useState } from 'react'
import { requestPasswordReset, signIn } from '../supabase'
import { recordMyAuditEvent } from '../audit'
import { Dumbbell, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login({ notice = '' }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [sent, setSent] = useState(false)

  const gymName = import.meta.env.VITE_GYM_NAME || 'GymApp'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || (!resetMode && !password)) { setError('Completa todos los campos'); return }
    setLoading(true)
    setError('')

    if (resetMode) {
      const { error: resetError } = await requestPasswordReset(email.trim().toLowerCase())
      setLoading(false)
      if (resetError) setError(resetError.message || 'No se pudo enviar el enlace')
      else setSent(true)
      return
    }

    const { error: err } = await signIn(email, password)

    if (err) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    await recordMyAuditEvent('session.login')

    // No hacemos nada más aquí.
    // onAuthStateChange en App.jsx detecta el SIGNED_IN y navega automáticamente.
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-700/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500/10 border border-brand-500/30 rounded-2xl mb-4">
            <Dumbbell className="w-8 h-8 text-brand-500" />
          </div>
          <h1 className="font-display text-4xl tracking-wider text-white">{gymName}</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de gestión deportiva</p>
        </div>

        {/* Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-2">
            {resetMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
          </h2>
          {resetMode && (
            <p className="text-sm text-gray-500 mb-5">Te enviaremos un enlace seguro para definir una contraseña nueva.</p>
          )}

          {notice && (
            <div className="text-sm text-brand-300 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2.5 mb-4">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="tu@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {sent && (
              <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                Si el correo existe, recibirás el enlace de recuperación. Revisa también spam.
              </div>
            )}

            {!resetMode && <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : resetMode ? 'Enviar enlace' : 'Entrar'}
            </button>
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              onClick={() => { setResetMode(value => !value); setError(''); setSent(false) }}
            >
              {resetMode ? 'Volver al inicio de sesión' : 'Olvidé mi contraseña'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          ¿Problemas para entrar? Contacta a tu administrador
        </p>
      </div>
    </div>
  )
}
