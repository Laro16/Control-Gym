import { useState } from 'react'
import { FileText, FileSpreadsheet, Users } from 'lucide-react'
import {
  supabase, adminCreateUser,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement,
  updateMember, deleteMember, getPlans, createPlan, updatePlan,
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

// ── ADMIN REPORTS ──────────────────────────────────────────
export function AdminReports({ members, payments }) {
  const [selectedMember, setSelectedMember] = useState('')

  const member = members.find(m => m.id === selectedMember)
  const memberPayments = payments.filter(p => p.member_id === selectedMember)

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="section-title">Reportes</h2>

      {/* Descarga global */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte global</h3>
        <p className="text-sm text-gray-400 mb-4">Descarga toda la información del gimnasio</p>
        <button className="btn-primary" onClick={() => generateMasterExcel(members, payments)}>
          <FileSpreadsheet className="w-4 h-4" /> Descargar Excel maestro
        </button>
      </div>

      {/* Por miembro */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte por miembro</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Seleccionar miembro</label>
            <select className="input" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.profile?.full_name}</option>)}
            </select>
          </div>
          {selectedMember && (
            <div className="flex flex-wrap gap-2 mt-2">
              <button className="btn-primary" onClick={() => generatePaymentHistoryPDF(memberPayments, member)}>
                <FileText className="w-4 h-4" /> PDF historial
              </button>
              <button className="btn-secondary" onClick={() => generatePaymentHistoryExcel(memberPayments, member)}>
                <FileSpreadsheet className="w-4 h-4" /> Excel historial
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// USER DASHBOARD
// ════════════════════════════════════════════════════════════
