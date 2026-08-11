import { useState } from 'react'
import { AlertCircle, KeyRound, LogOut } from 'lucide-react'
import { completeInitialPasswordChange, updateCurrentPassword } from '../supabase'
import { recordMyAuditEvent } from '../audit'

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
    await recordMyAuditEvent('account.password_changed')
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
    await recordMyAuditEvent('account.password_changed')
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
