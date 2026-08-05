import { formatDate, formatCurrency } from './helpers'

const GYM_WHATSAPP = import.meta.env.VITE_GYM_WHATSAPP || '50212345678'
const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

// Limpiar número de WhatsApp (solo dígitos)
const cleanNumber = (num) => {
  const digits = String(num || '').replace(/\D/g, '')
  return digits.length === 8 ? `502${digits}` : digits
}

// Abrir WhatsApp con mensaje predefinido
export const sendWhatsApp = (number, message) => {
  const clean = cleanNumber(number)
  if (!clean) return false
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${clean}?text=${encoded}`, '_blank')
  return true
}

// Enviar comprobante al administrador
export const sendVoucherToAdmin = (payment, member, gym = null) => {
  const method = payment.payment_method === 'cash'
    ? `💵 EFECTIVO — Q ${Number(payment.amount).toFixed(2)}`
    : `🧾 ${payment.payment_method === 'transfer' ? 'TRANSFERENCIA' : 'DEPÓSITO'}`

  const message = `
🏋️ *${gym?.name || GYM_NAME}*
━━━━━━━━━━━━━━━━━━
📋 *Comprobante de Pago*

👤 *Nombre:* ${member?.profile?.full_name}
💰 *Monto:* ${formatCurrency(payment.amount)}
💳 *Método:* ${method}
📅 *Fecha de pago:* ${formatDate(payment.payment_date || new Date())}
📅 *Vencimiento:* ${formatDate(payment.due_date)}
━━━━━━━━━━━━━━━━━━
Por favor confirmar recepción ✅
`.trim()

  return sendWhatsApp(gym?.whatsapp_number || GYM_WHATSAPP, message)
}

// Notificar al usuario que su pago fue aprobado
export const notifyPaymentApproved = (payment, member, gym = null) => {
  const message = `
✅ *${gym?.name || GYM_NAME}*
Tu pago de ${formatCurrency(payment.amount)} ha sido *APROBADO*.
Fecha: ${formatDate(payment.payment_date)}
¡Gracias por tu puntualidad! 💪
`.trim()

  if (member?.profile?.phone) {
    sendWhatsApp(member.profile.phone, message)
  }
}

// Recordatorio de pago próximo a vencer
export const sendPaymentReminder = (payment, member, gym = null) => {
  const message = `
⚠️ *${gym?.name || GYM_NAME}*
Hola ${member?.profile?.full_name}, tu mensualidad vence el *${formatDate(payment.due_date)}*.
Monto: ${formatCurrency(payment.amount)}

Por favor realiza tu pago a tiempo para seguir disfrutando de nuestro gimnasio 🏋️
`.trim()

  if (member?.profile?.phone) {
    sendWhatsApp(member.profile.phone, message)
  }
}
