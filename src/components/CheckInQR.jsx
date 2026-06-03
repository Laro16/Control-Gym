import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, Printer, Download, RefreshCw, Check, Copy, AlertCircle } from 'lucide-react'
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
  const qrRef = useRef(null)

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
        <div ref={qrRef} className="bg-white p-4 rounded-2xl">
          <QRCodeCanvas value={checkinUrl} size={220} level="M" includeMargin={false} />
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
        </div>
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
    </div>
  )
}
