import { useState, useEffect } from 'react'
import { X, Check, CheckCircle, AlertCircle, Info } from 'lucide-react'
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
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
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
