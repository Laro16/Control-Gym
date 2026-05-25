import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, CreditCard, Bell, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet,
  Dumbbell, TrendingUp, TrendingDown, Minus, Camera, Calendar,
  LogOut, Home, ClipboardList, MessageCircle, Eye,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle, Layers,
  Sun, Moon, Lock, Flame, Trophy, Star
} from 'lucide-react'
import { playNotifSound, playAchievementSound } from '../App'
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

// ── USER HOME ──────────────────────────────────────────────
export function UserHome({ member, payments, profile }) {
  const lastPayment = payments[0]
  const payStatus = lastPayment ? getPaymentStatus(lastPayment.due_date) : null
  const stLabel = payStatus ? paymentStatusLabel[payStatus] : null

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="section-title">Hola, {profile.full_name.split(' ')[0]} 💪</h2>
        {member && <p className="text-gray-500 text-sm mt-1">Miembro desde {formatDate(member.start_date)}</p>}
      </div>

      {member && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Inicio</p>
            <p className="font-semibold text-white mt-1">{formatDate(member.start_date)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Plan actual</p>
            <p className="font-semibold text-white mt-1">{member.plan?.name || 'Sin plan'}</p>
          </div>
        </div>
      )}

      {lastPayment && (
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Estado de cuota</p>
            <span className={stLabel.cls}>{stLabel.text}</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">{formatCurrency(lastPayment.amount)}</p>
          <p className="text-sm text-gray-500">Vence el {formatDate(lastPayment.due_date)}</p>
        </div>
      )}

      {!member && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Tu perfil de miembro aún no está configurado. Contacta al administrador.</p>
        </div>
      )}
    </div>
  )
}
