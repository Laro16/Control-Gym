import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, Printer, Download, RefreshCw, Check, Copy, AlertCircle, MonitorSmartphone } from 'lucide-react'
import { getMyGym, updateGym } from '../supabase'
import { Spinner } from './shared'

function randomCode() {
  // 10 caracteres alfanuméricos
  return Array.from({ length: 10 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('')
}

export function CheckInQR({ profile }) {
  const [gym, setGym]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [copied, setCopied]   = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [kiosk, setKiosk] = useState(false)
  const qrRef = useRef(null)

  const enterKiosk = () => {
    setKiosk(true)
    // Pantalla completa real si el dispositivo lo permite (tablet en recepción)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const exitKiosk = () => {
    setKiosk(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getMyGym(profile.gym_id)
    setGym(data || null)
    setLoading(false)
  }, [profile.gym_id])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (!gym) return (
    <div className="card text-center py-10">
      <AlertCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
      <p className="text-gray-400 text-sm">No se pudo cargar el gimnasio.</p>
    </div>
  )

  const checkinUrl = `${window.location.origin}/#checkin/${gym.checkin_code}`

  const getCanvas = () => qrRef.current?.querySelector('canvas')

  const handleDownload = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `check-in-${gym.name.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  const handlePrint = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const w = window.open('', '_blank', 'width=600,height=800')
    if (!w) return
    w.document.write(`
      <html><head><title>Check-in ${gym.name}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#111}
        h1{font-size:28px;margin:0 0 4px}
        p{color:#555;margin:0 0 32px;font-size:16px}
        img{width:340px;height:340px}
        .foot{margin-top:28px;font-size:15px;color:#333}
      </style></head>
      <body>
        <h1>${gym.name}</h1>
        <p>Escanea para registrar tu asistencia</p>
        <img src="${dataUrl}" />
        <p class="foot">Apunta la cámara de tu teléfono al código</p>
        <script>window.onload=()=>{window.print()}</script>
      </body></html>
    `)
    w.document.close()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* sin portapapeles */ }
  }

  const handleRegenerate = async () => {
    setBusy(true)
    const newCode = randomCode()
    const { data } = await updateGym(profile.gym_id, { checkin_code: newCode })
    if (data) setGym(data)
    setConfirmRegen(false)
    setBusy(false)
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-xl">
      <div>
        <h2 className="section-title flex items-center gap-2">
          <QrCode className="w-5 h-5 text-brand-500" />
          Código de check-in
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Imprime este QR y pégalo en la entrada. Tus miembros lo escanean para registrar su asistencia.
        </p>
      </div>

      <div className="card flex flex-col items-center text-center">
        <div className="relative">
          <span
            className="absolute -inset-3 rounded-3xl bg-brand-500/15 animate-ping pointer-events-none"
            style={{ animationDuration: '3s' }}
          />
          <span className="absolute -inset-3 rounded-3xl border border-brand-500/25 pointer-events-none" />
          <div ref={qrRef} className="relative bg-white p-4 rounded-2xl">
            <QRCodeCanvas value={checkinUrl} size={220} level="H" includeMargin={false} />
            {gym.logo_url && (
              <img
                src={gym.logo_url}
                alt=""
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-xl object-cover ring-4 ring-white shadow"
              />
            )}
          </div>
        </div>
        <p className="font-semibold text-white mt-4">{gym.name}</p>
        <p className="text-xs text-gray-500">Escanea para registrar tu asistencia</p>

        <div className="flex flex-wrap gap-2 justify-center mt-5 w-full">
          <button className="btn-primary flex-1 min-w-[140px]" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button className="btn-secondary flex-1 min-w-[140px]" onClick={handleDownload}>
            <Download className="w-4 h-4" /> Descargar PNG
          </button>
          <button className="btn-secondary flex-1 min-w-[140px]" onClick={enterKiosk}>
            <MonitorSmartphone className="w-4 h-4" /> Pantalla de recepción
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">
          💡 ¿Tienes una tablet en recepción? Usa "Pantalla de recepción" y déjala fija mostrando el QR.
        </p>
      </div>

      <div className="card space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Enlace del check-in</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-gray-300 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 truncate">
            {checkinUrl}
          </code>
          <button className="btn-ghost p-2 rounded-lg" onClick={handleCopy} title="Copiar enlace">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {confirmRegen ? (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 space-y-3">
            <p className="text-yellow-400/90 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Al regenerar, el QR anterior dejará de funcionar. Tendrás que imprimir y pegar el nuevo.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setConfirmRegen(false)} disabled={busy}>
                Cancelar
              </button>
              <button className="btn-danger flex-1" onClick={handleRegenerate} disabled={busy}>
                {busy ? 'Regenerando...' : 'Sí, regenerar'}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-secondary w-full" onClick={() => setConfirmRegen(true)}>
            <RefreshCw className="w-4 h-4" /> Regenerar código
          </button>
        )}
      </div>

      {/* ── MODO PANTALLA DE RECEPCIÓN (kiosko) ────────── */}
      {kiosk && (
        <div
          className="fixed inset-0 z-[95] bg-gray-950 flex flex-col items-center justify-center gap-7 animate-fade-in cursor-pointer select-none"
          onClick={exitKiosk}
        >
          {gym.logo_url && (
            <img src={gym.logo_url} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          )}
          <h1 className="font-display text-4xl sm:text-6xl tracking-wider text-white text-center px-6 leading-none">
            {gym.name}
          </h1>

          <div className="relative my-2">
            <span
              className="absolute -inset-5 rounded-[2.5rem] bg-brand-500/20 animate-ping pointer-events-none"
              style={{ animationDuration: '2.8s' }}
            />
            <span className="absolute -inset-5 rounded-[2.5rem] border-2 border-brand-500/30 pointer-events-none" />
            <div className="relative bg-white p-6 rounded-[2rem] shadow-2xl">
              <QRCodeCanvas value={checkinUrl} size={300} level="H" includeMargin={false} />
              {gym.logo_url && (
                <img
                  src={gym.logo_url}
                  alt=""
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-xl object-cover ring-4 ring-white shadow"
                />
              )}
            </div>
          </div>

          <p className="text-brand-400 font-bold text-xl sm:text-2xl text-center px-6">
            Escanea para marcar tu asistencia
          </p>
          <p className="text-gray-600 text-sm">y mantén tu racha encendida 🔥</p>

          <p className="text-gray-700 text-xs absolute bottom-5">Toca la pantalla para salir</p>
        </div>
      )}
    </div>
  )
}
