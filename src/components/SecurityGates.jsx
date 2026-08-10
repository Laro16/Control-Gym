import { useEffect, useState } from 'react'
import { AlertCircle, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { supabase, completeInitialPasswordChange, updateCurrentPassword } from '../supabase'

const PasswordForm = ({ title, subtitle, buttonLabel, onSubmit, onLogout }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (password.length < 10) { setError('Usa al menos 10 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setBusy(true)
    setError('')
    try {
      await onSubmit(password)
    } catch (submitError) {
      setError(submitError.message || 'No se pudo actualizar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6 text-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">{subtitle}</p>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Nueva contraseña</label>
            <input type="password" autoComplete="new-password" className="input" value={password} onChange={event => setPassword(event.target.value)} />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input type="password" autoComplete="new-password" className="input" value={confirm} onChange={event => setConfirm(event.target.value)} />
          </div>
          {error && <p className="text-red-400 text-sm flex gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Guardando...' : buttonLabel}
          </button>
        </form>
        {onLogout && (
          <button className="btn-ghost w-full mt-3" onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        )}
      </div>
    </div>
  )
}

export function ForcePasswordChange({ onComplete, onLogout }) {
  const save = async (password) => {
    const { error: passwordError } = await updateCurrentPassword(password)
    if (passwordError) throw passwordError
    const { error: completionError } = await completeInitialPasswordChange()
    if (completionError) throw completionError
    onComplete()
  }
  return (
    <PasswordForm
      title="Cambia tu contraseña temporal"
      subtitle="El administrador no debe conservar acceso a tu cuenta. Define una contraseña personal antes de continuar."
      buttonLabel="Guardar y continuar"
      onSubmit={save}
      onLogout={onLogout}
    />
  )
}

export function RecoveryPasswordGate({ onComplete, onLogout }) {
  const save = async (password) => {
    const { error } = await updateCurrentPassword(password)
    if (error) throw error
    onComplete()
  }
  return (
    <PasswordForm
      title="Recuperar acceso"
      subtitle="Define una contraseña nueva para tu cuenta."
      buttonLabel="Actualizar contraseña"
      onSubmit={save}
      onLogout={onLogout}
    />
  )
}

export function AdminMfaGate({ children, onLogout }) {
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [factor, setFactor] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const prepare = async () => {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (cancelled) return
      if (assurance?.currentLevel === 'aal2') {
        setVerified(true)
        setLoading(false)
        return
      }

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (listError) { setError(listError.message); setLoading(false); return }
      const verifiedFactor = factors?.totp?.find(item => item.status === 'verified')
      if (verifiedFactor) {
        setFactor(verifiedFactor)
        setLoading(false)
        return
      }

      for (const pending of factors?.totp?.filter(item => item.status !== 'verified') || []) {
        await supabase.auth.mfa.unenroll({ factorId: pending.id })
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Control Gym Administrador',
      })
      if (cancelled) return
      if (enrollError) setError(enrollError.message)
      else {
        setEnrollment(enrolled)
        setFactor({ id: enrolled.id })
      }
      setLoading(false)
    }
    prepare()
    return () => { cancelled = true }
  }, [])

  const verify = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError('Ingresa el código de 6 dígitos'); return }
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    })
    setBusy(false)
    if (verifyError) setError(verifyError.message || 'Código no válido')
    else setVerified(true)
  }

  if (verified) return children
  if (loading) return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-gray-800 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">Verificación administrativa</h1>
        <p className="text-sm text-gray-500 mt-1">
          {enrollment ? 'Escanea el QR con tu aplicación de autenticación y confirma el primer código.' : 'Ingresa el código de tu aplicación de autenticación.'}
        </p>

        {enrollment?.totp?.qr_code && (
          <div className="bg-white rounded-2xl p-3 my-5 inline-block">
            <img src={enrollment.totp.qr_code} alt="QR para activar MFA" className="w-48 h-48" />
          </div>
        )}
        {enrollment?.totp?.secret && (
          <p className="text-xs text-gray-500 break-all mb-4">Clave manual: <code>{enrollment.totp.secret}</code></p>
        )}

        <form onSubmit={verify} className="space-y-3 mt-5">
          <input
            className="input text-center text-xl tracking-[0.35em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="000000"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy || !factor}>
            {busy ? 'Verificando...' : 'Verificar y entrar'}
          </button>
        </form>
        <button className="btn-ghost w-full mt-3" onClick={onLogout}>
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
