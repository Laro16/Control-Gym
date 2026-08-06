import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getBrandRGB } from './theme.js'
import { formatDate, today } from './helpers.js'

const safeFilename = value => String(value || 'miembro')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'miembro'

const loadImageAsBase64 = url => new Promise(resolve => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    resolve(canvas.toDataURL('image/jpeg'))
  }
  img.onerror = () => resolve(null)
  img.src = url
})

export const generatePaymentPDF = async (payment, member) => {
  const doc = new jsPDF()
  const gymName = import.meta.env?.VITE_GYM_NAME || 'Mi Gimnasio'

  doc.setFillColor(...getBrandRGB())
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(gymName, 14, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Comprobante de Pago', 14, 30)

  doc.setTextColor(30, 30, 30)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL MIEMBRO', 14, 54)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)

  const memberInfo = [
    ['Nombre:', member?.profile?.full_name || '—'],
    ['Email:', member?.profile?.email || '—'],
    ['Teléfono:', member?.profile?.phone || '—'],
    ['Fecha de inicio:', formatDate(member?.start_date)],
  ]
  let y = 62
  memberInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 55, y)
    y += 8
  })

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('DETALLE DE PAGO', 14, y)
  y += 8
  doc.setFontSize(11)

  const paymentInfo = [
    ['Monto:', `Q ${Number(payment.amount).toFixed(2)}`],
    ['Método:', payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Depósito'],
    ['Fecha de pago:', formatDate(payment.payment_date)],
    ['Fecha de vencimiento:', formatDate(payment.due_date)],
    ['Estado:', payment.status === 'approved' ? 'APROBADO' : payment.status === 'pending' ? 'PENDIENTE' : 'RECHAZADO'],
  ]
  paymentInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 65, y)
    y += 8
  })

  if (payment.payment_method === 'cash') {
    y += 6
    doc.setFillColor(...getBrandRGB())
    doc.roundedRect(14, y, 182, 18, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`PAGO EN EFECTIVO: Q ${Number(payment.amount).toFixed(2)}`, 105, y + 12, { align: 'center' })
    doc.setTextColor(30, 30, 30)
    y += 28
  }

  if (payment.voucher_url) {
    try {
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('COMPROBANTE:', 14, y)
      y += 4
      const image = await loadImageAsBase64(payment.voucher_url)
      if (image) doc.addImage(image, 'JPEG', 14, y, 80, 60)
    } catch {
      // El comprobante es opcional dentro del PDF; el resto se descarga igual.
    }
  }

  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generado el ${formatDate(today())} — ${gymName}`, 105, 285, { align: 'center' })
  doc.save(`comprobante_${safeFilename(member?.profile?.full_name)}_${safeFilename(payment.due_date)}.pdf`)
}

export const buildPaymentHistoryPDF = (payments, member) => {
  const doc = new jsPDF()
  const gymName = import.meta.env?.VITE_GYM_NAME || 'Mi Gimnasio'

  doc.setFillColor(...getBrandRGB())
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`${gymName} — Historial de Pagos`, 14, 12)
  doc.setFontSize(10)
  doc.text(`${member?.profile?.full_name || ''} — Generado: ${formatDate(today())}`, 14, 22)

  autoTable(doc, {
    startY: 40,
    head: [['Fecha pago', 'Vence', 'Monto', 'Método', 'Estado']],
    body: (payments || []).map(payment => [
      formatDate(payment.payment_date),
      formatDate(payment.due_date),
      `Q ${Number(payment.amount).toFixed(2)}`,
      payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Depósito',
      payment.status === 'approved' ? 'Aprobado' : payment.status === 'pending' ? 'Pendiente' : 'Rechazado',
    ]),
    headStyles: { fillColor: getBrandRGB(), textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  return doc
}

export const generatePaymentHistoryPDF = async (payments, member) => {
  const doc = buildPaymentHistoryPDF(payments, member)
  doc.save(`historial_pagos_${safeFilename(member?.profile?.full_name)}.pdf`)
}
