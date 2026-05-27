import { useState } from 'react'
import { Camera, Lock, LogOut, X, Check, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabase'
import { formatDate } from '../utils/helpers'

export function UserAccountPanel({ profile, member, onClose, onLogout, onRefresh }) {
  const [tab, setTab]               = useState('profile')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const age = profile.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date)) / (365.25 * 24 * 3600 * 1000))
    : null

  // ── CAMBIAR CONTRASEÑA ─────────────────────────────────
  const handleChangePassword = async () => {
    setMsg(null)
    if (newPassword.length < 6) { setMsg({ text: 'Mínimo 6 caracteres', ok: false }); return }
    if (newPassword !== confirmPass) { setMsg({ text: 'Las contraseñas no coinciden', ok: false }); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setMsg({ text: 'Error: ' + error.message, ok: false })
    } else {
      setMsg({ text: '¡Contraseña actualizada!', ok: true })
      setNewPassword('')
      setConfirmPass('')
    }
  }

  // ── SUBIR FOTO DE PERFIL ───────────────────────────────
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local inmediato
    setAvatarPreview(URL.createObjectURL(file))
    setUploading(true)
    setMsg(null)

    try {
      const ext  = file.name.split('.').pop().toLowerCase() || 'jpg'
      const path = `${profile.id}/avatar.${ext}`

      // Eliminar avatar anterior si existe (evita conflictos de caché)
      await supabase.storage.from('avatars').remove([path])

      // Subir nuevo archivo
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          upsert:       true,
          cacheControl: '1',
          contentType:  file.type || 'image/jpeg',
        })

      if (uploadErr) {
        setMsg({ text: 'Error al subir: ' + uploadErr.message, ok: false })
        setAvatarPreview(null)
        setUploading(false)
        return
      }

      // URL pública con cache-buster
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const finalUrl = `${urlData.publicUrl}?v=${Date.now()}`

      // Guardar en profiles
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', profile.id)

      if (updateErr) {
        setMsg({ text: 'Foto subida pero no se pudo guardar. Intenta de nuevo.', ok: false })
      } else {
        setMsg({ text: '¡Foto de perfil actualizada!', ok: true })
        onRefresh()
      }
    } catch (err) {
      setMsg({ text: 'Error inesperado: ' + err.message, ok: false })
      setAvatarPreview(null)
    }

    setUploading(false)
  }

  const displayAvatar = avatarPreview || profile.avatar_url

  return (
    <div
      className="absolute right-2 sm:right-4 top-14 w-[calc(100vw-1rem)] sm:w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-[85vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      {/* ── HEADER CON AVATAR ─────────────────────────────── */}
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-800">
        <div className="relative flex-shrink-0">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt="avatar"
              className={`w-14 h-14 rounded-full object-cover border-2 border-brand-500/40 transition-opacity ${uploading ? 'opacity-40' : ''}`}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center">
              <span className="text-brand-400 text-xl font-bold">
                {profile.full_name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Botón cámara sobre el avatar */}
          <label className={`absolute -bottom-1 -right-1 w-7 h-7 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all active:scale-90 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading
              ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Camera className="w-3.5 h-3.5 text-white" />
            }
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="user"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </label>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{profile.full_name}</p>
          <p className="text-xs text-gray-500 truncate">{profile.email}</p>
          {age && <p className="text-xs text-gray-600 mt-0.5">{age} años</p>}
          <span className="text-[10px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full">
            {member?.plan?.name || 'Sin plan'}
          </span>
        </div>

        <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mensaje estado */}
      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2
          ${msg.ok
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'profile',  label: 'Mi ficha' },
          { id: 'password', label: 'Contraseña' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMsg(null) }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all
              ${tab === t.id
                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FICHA ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-1">
          {[
            { label: 'Nombre',          value: profile.full_name },
            { label: 'Email',           value: profile.email },
            { label: 'Teléfono',        value: profile.phone || '—' },
            { label: 'Edad',            value: age ? `${age} años` : '—' },
            { label: 'Fecha nacimiento',value: profile.birth_date ? formatDate(profile.birth_date) : '—' },
            { label: 'Plan actual',     value: member?.plan?.name || '—' },
            { label: 'Precio del plan', value: member?.plan?.price ? `Q ${Number(member.plan.price).toFixed(2)}/mes` : '—' },
            { label: 'Miembro desde',   value: member?.start_date ? formatDate(member.start_date) : '—' },
            { label: 'Estado',          value: member?.status === 'active' ? '✅ Activo' : '⚠️ ' + (member?.status || 'Sin datos') },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-2 border-b border-gray-800/50 last:border-0">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className="text-xs text-white font-medium text-right max-w-[55%] truncate">{r.value}</span>
            </div>
          ))}

          <div className="pt-3">
            <p className="text-[10px] text-gray-600 text-center mb-3">
              Para actualizar tus datos contacta al administrador
            </p>
            <button
              onClick={() => { onClose(); onLogout() }}
              className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm py-2.5 px-3 rounded-xl hover:bg-red-500/10 border border-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── CONTRASEÑA ────────────────────────────────────── */}
      {tab === 'password' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Elige una contraseña segura de al menos 6 caracteres.
          </p>
          <div>
            <label className="label text-xs">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input text-sm pr-10"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                onClick={() => setShowPass(s => !s)}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label text-xs">Confirmar contraseña</label>
            <input
              type={showPass ? 'text' : 'password'}
              className="input text-sm"
              placeholder="Repite la contraseña"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
            />
          </div>

          {/* Indicador de fortaleza */}
          {newPassword.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                    newPassword.length >= i * 3
                      ? i <= 2 ? 'bg-red-500' : i === 3 ? 'bg-yellow-500' : 'bg-emerald-500'
                      : 'bg-gray-700'
                  }`} />
                ))}
              </div>
              <p className="text-[10px] text-gray-500">
                {newPassword.length < 6 ? 'Muy corta' : newPassword.length < 9 ? 'Débil' : newPassword.length < 12 ? 'Buena' : '¡Muy segura!'}
              </p>
            </div>
          )}

          <button
            className="btn-primary w-full text-sm"
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPass}
          >
            {saving
              ? <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </span>
              : <><Lock className="w-3.5 h-3.5" /> Cambiar contraseña</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
