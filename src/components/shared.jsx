import { useState, useEffect, useRef } from 'react'
import { X, Check, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import { paymentStatusLabel } from '../utils/helpers'

// ── TOASTS ─────────────────────────────────────────────────
// Sistema de notificaciones flotantes sin provider.
// Uso: import { toast } from './shared'
//   toast.success('Pago registrado')
//   toast.error('Error al subir el comprobante')
//   toast.info('Este miembro no tiene teléfono')
// <Toaster /> se monta UNA vez en App.jsx

const emitToast = (type, message) => {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message, id: Date.now() + Math.random() } }))
}

export const toast = {
  success: (m) => emitToast('success', m),
  error:   (m) => emitToast('error', m),
  info:    (m) => emitToast('info', m),
}

const TOAST_STYLES = {
  success: { icon: CheckCircle, cls: 'border-emerald-500/40 text-emerald-400', iconCls: 'text-emerald-400' },
  error:   { icon: AlertCircle, cls: 'border-red-500/40 text-red-400',         iconCls: 'text-red-400' },
  info:    { icon: Info,        cls: 'border-brand-500/40 text-brand-400',     iconCls: 'text-brand-400' },
}

export function Toaster() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail
      setToasts(prev => [...prev.slice(-2), t]) // máximo 3 visibles
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 3500)
    }
    window.addEventListener('app-toast', onToast)
    return () => window.removeEventListener('app-toast', onToast)
  }, [])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-24 md:bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map(t => {
        const s = TOAST_STYLES[t.type] || TOAST_STYLES.info
        const Icon = s.icon
        return (
          <div
            key={t.id}
            className={`card pointer-events-auto flex items-center gap-3 py-3 px-4 border shadow-2xl animate-slide-up ${s.cls}`}
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${s.iconCls}`} />
            <p className="text-sm text-gray-100 flex-1 leading-snug">{t.message}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── COUNT-UP ───────────────────────────────────────────────
// Anima un número de 0 hasta su valor (ease-out). Respeta la
// preferencia de "reducir movimiento" del sistema del usuario.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(target || 0)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (!target || target <= 0 || reduce) { setValue(target || 0); return }

    let raf, start
    const tick = (t) => {
      if (start === undefined) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

// ── PULL TO REFRESH ────────────────────────────────────────
// Jalar hacia abajo desde arriba de la página para recargar datos.
// Esencial en la PWA instalada: a pantalla completa no hay botón de
// recargar del navegador. Solo se activa en pantallas táctiles.
const PTR_THRESHOLD = 70   // px para disparar
const PTR_MAX       = 110  // px máximo de arrastre visual

export function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull]             = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY   = useRef(null)
  const buzzed   = useRef(false)

  const onTouchStart = (e) => {
    if (refreshing) return
    // Solo si estamos exactamente arriba de la página
    startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null
    buzzed.current = false
  }

  const onTouchMove = (e) => {
    if (startY.current === null || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0 || window.scrollY > 0) { setPull(0); return }
    const damped = Math.min(PTR_MAX, dy * 0.45) // resistencia
    setPull(damped)
    if (damped >= PTR_THRESHOLD && !buzzed.current) {
      buzzed.current = true
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }

  const onTouchEnd = async () => {
    if (startY.current === null || refreshing) return
    startY.current = null
    if (pull >= PTR_THRESHOLD) {
      setRefreshing(true)
      setPull(56) // mantener visible el spinner
      try { await onRefresh?.() } finally {
        setRefreshing(false)
        setPull(0)
      }
    } else {
      setPull(0)
    }
  }

  const progress = Math.min(1, pull / PTR_THRESHOLD)

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Indicador */}
      <div
        className="flex justify-center overflow-hidden"
        style={{ height: pull, transition: startY.current === null ? 'height 0.25s ease' : 'none' }}
      >
        <div
          className="mt-3 w-9 h-9 rounded-full bg-gray-900 border border-gray-700 shadow-lg flex items-center justify-center"
          style={{ opacity: Math.max(0.25, progress) }}
        >
          <RefreshCw
            className={`w-4 h-4 ${progress >= 1 ? 'text-brand-400' : 'text-gray-500'} ${refreshing ? 'animate-spin' : ''}`}
            style={!refreshing ? { transform: `rotate(${progress * 270}deg)` } : undefined}
          />
        </div>
      </div>
      {children}
    </div>
  )
}

// ── SKELETON LOADERS ───────────────────────────────────────
// Reemplazan al spinner genérico: la app "dibuja" su estructura
// mientras carga y se siente mucho más rápida.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-800/60 rounded-2xl ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-lg mx-auto animate-fade-in">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

export function StatusDot({ status }) {
  const s = paymentStatusLabel[status] || paymentStatusLabel.current
  return <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-semibold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, message }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirmar acción">
      <p className="text-gray-300 mb-5">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-danger" onClick={() => { onConfirm(); onClose() }}>Confirmar</button>
      </div>
    </Modal>
  )
}
