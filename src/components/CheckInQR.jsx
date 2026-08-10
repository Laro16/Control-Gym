import { useState, useEffect, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, RefreshCw, AlertCircle, MonitorSmartphone, ShieldCheck, Clock } from 'lucide-react'
import { getMyGym, issueCheckinToken } from '../supabase'
import { Spinner, toast } from './shared'

const TOKEN_TTL_SECONDS = 90
const REFRESH_EVERY_MS = 60_000

export function CheckInQR({ profile }) {
  const [gym, setGym] = useState(null)
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [kiosk, setKiosk] = useState(false)

  const refreshToken = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    const { data, error } = await issueCheckinToken(TOKEN_TTL_SECONDS)
    if (error || !data?.token) {
      setToken('')
      setExpiresAt(null)
      toast.error(error?.message || 'No se pudo emitir el código temporal')
    } else {
      setToken(data.token)
      setExpiresAt(data.expires_at)
    }
    if (!quiet) setRefreshing(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await getMyGym(profile.gym_id)
      if (cancelled) return
      setGym(data || null)
      setLoading(false)
      if (error) toast.error(error.message || 'No se pudo cargar el gimnasio')
      if (data) await refreshToken(true)
    }
    load()
    return () => { cancelled = true }
  }, [profile.gym_id, refreshToken])

  useEffect(() => {
    if (!gym) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshToken(true)
    }, REFRESH_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [gym, refreshToken])

  useEffect(() => {
    const update = () => {
      const remaining = expiresAt
        ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
        : 0
      setSecondsLeft(remaining)
      if (remaining === 0 && expiresAt) setToken('')
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const enterKiosk = () => {
    setKiosk(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exitKiosk = () => {
    setKiosk(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  if (loading) return <Spinner />
  if (!gym) return (
    <div className="card text-center py-10">
      <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
      <p className="text-gray-400 text-sm">No se pudo cargar el gimnasio.</p>
    </div>
  )

  const checkinUrl = token ? `${window.location.origin}/#checkin/${token}` : ''
  const qr = checkinUrl ? (
    <QRCodeCanvas value={checkinUrl} size={260} level="H" includeMargin={false} />
  ) : (
    <div className="w-[260px] h-[260px] flex items-center justify-center text-gray-500 text-sm px-8">
      Código vencido. Presiona actualizar.
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in max-w-xl">
      <div>
        <h2 className="section-title flex items-center gap-2">
          <QrCode className="w-5 h-5 text-brand-500" />
          Check-in seguro
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          El QR cambia automáticamente y solo funciona durante unos segundos. Muéstralo en una tablet o monitor de recepción.
        </p>
      </div>

      <div className="card flex flex-col items-center text-center">
        <div className="relative bg-white p-5 rounded-2xl">
          {qr}
          {gym.logo_url && checkinUrl && (
            <img
              src={gym.logo_url}
              alt=""
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl object-cover ring-4 ring-white shadow"
            />
          )}
        </div>
        <p className="font-semibold text-white mt-4">{gym.name}</p>
        <p className={`text-xs mt-1 flex items-center gap-1.5 ${secondsLeft <= 15 ? 'text-yellow-400' : 'text-emerald-400'}`}>
          <Clock className="w-3.5 h-3.5" />
          {secondsLeft > 0 ? `Válido por ${secondsLeft} s` : 'Código vencido'}
        </p>

        <div className="flex flex-wrap gap-2 justify-center mt-5 w-full">
          <button className="btn-secondary flex-1 min-w-[140px]" onClick={() => refreshToken()} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button className="btn-primary flex-1 min-w-[180px]" onClick={enterKiosk}>
            <MonitorSmartphone className="w-4 h-4" /> Pantalla de recepción
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <p className="text-sm text-emerald-100/80">
          El enlace no se guarda en la ficha del gimnasio y deja de funcionar al vencer. Ya no existe un QR permanente para compartir fuera del local.
        </p>
      </div>

      {kiosk && (
        <div
          className="fixed inset-0 z-[95] bg-gray-950 flex flex-col items-center justify-center gap-7 animate-fade-in cursor-pointer select-none"
          onClick={exitKiosk}
        >
          {gym.logo_url && <img src={gym.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />}
          <h1 className="font-display text-4xl sm:text-6xl tracking-wider text-white text-center px-6 leading-none">
            {gym.name}
          </h1>
          <div className="relative bg-white p-7 rounded-[2rem] shadow-2xl">{qr}</div>
          <p className="text-brand-400 font-bold text-xl sm:text-2xl text-center px-6">
            Escanea para marcar tu asistencia
          </p>
          <p className={`text-sm ${secondsLeft <= 15 ? 'text-yellow-400' : 'text-gray-500'}`}>
            El código se renueva automáticamente · {secondsLeft} s
          </p>
          <p className="text-gray-700 text-xs absolute bottom-5">Toca la pantalla para salir</p>
        </div>
      )}
    </div>
  )
}
