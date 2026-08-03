import { Check, ClipboardList } from 'lucide-react'
import {
  supabase, adminCreateUser,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement,
  updateMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  displayValue, getMeasurementComment, daysBetween,
  generatePaymentPDF, generatePaymentHistoryPDF, generatePaymentHistoryExcel,
  generateMasterExcel, today, addDays, calculateStreak
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner } from './shared'

// ── USER PLANES ────────────────────────────────────────────
export function UserPlans({ plans, currentPlanId }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Planes</h2>
      <div className="space-y-3">
        {plans.map(p => (
          <div key={p.id} className={`card-hover ${p.id === currentPlanId ? 'border-brand-500/40' : ''}`}>
            {p.id === currentPlanId && (
              <div className="badge-green mb-2 inline-flex">Tu plan actual</div>
            )}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{p.name}</h3>
                {p.description && <p className="text-sm text-gray-400 mt-0.5">{p.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-brand-400">{formatCurrency(p.price)}</p>
                <p className="text-xs text-gray-500">{p.duration_days} días</p>
              </div>
            </div>
            {p.features?.length > 0 && (
              <ul className="mt-3 space-y-1.5 pt-3 border-t border-gray-800">
                {p.features.map((f, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Sin planes disponibles
          </div>
        )}
      </div>
    </div>
  )
}
