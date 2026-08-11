import { useState } from 'react'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import {
  generatePaymentHistoryPDF,
} from '../utils/pdfExports'
import {
  generatePaymentHistoryExcel,
  generateGeneralReportExcel,
} from '../utils/excelExports'
import { toast } from './shared'

export function AdminReports({ members, payments, plans, gym }) {
  const [selectedMember, setSelectedMember] = useState('')
  const [exporting, setExporting] = useState(null)

  const member = members.find(item => item.id === selectedMember)
  const memberPayments = payments.filter(payment => payment.member_id === selectedMember)

  const runExport = async (id, action, successMessage) => {
    if (exporting) return
    setExporting(id)
    try {
      await action()
      toast.success(successMessage)
    } catch (error) {
      console.error(`Error al generar ${id}:`, error)
      toast.error(error?.message || 'No se pudo generar el archivo. Recarga la aplicación e intenta de nuevo.')
    } finally {
      setExporting(null)
    }
  }

  const ExportIcon = ({ id, icon: Icon }) => (
    exporting === id
      ? <Loader2 className="w-4 h-4 animate-spin" />
      : <Icon className="w-4 h-4" />
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="section-title">Reportes</h2>

      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte General</h3>
        <p className="text-sm text-gray-400 mb-4">
          Incluye un resumen ejecutivo y hojas detalladas de miembros, pagos y planes.
        </p>
        <button
          className="btn-primary"
          disabled={!!exporting}
          onClick={() => runExport(
            'general-excel',
            () => generateGeneralReportExcel(members, payments, plans, gym),
            'Reporte General descargado',
          )}
        >
          <ExportIcon id="general-excel" icon={FileSpreadsheet} />
          {exporting === 'general-excel' ? 'Generando Reporte...' : 'Descargar Reporte General'}
        </button>
      </div>

      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte por miembro</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Seleccionar miembro</label>
            <select
              className="input"
              value={selectedMember}
              onChange={event => setSelectedMember(event.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {members.map(item => (
                <option key={item.id} value={item.id}>{item.profile?.full_name}</option>
              ))}
            </select>
          </div>

          {member && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-gray-500">
                {memberPayments.length} {memberPayments.length === 1 ? 'pago registrado' : 'pagos registrados'}
              </p>
              <div className="flex flex-col min-[380px]:flex-row gap-2">
                <button
                  className="btn-primary"
                  disabled={!!exporting}
                  onClick={() => runExport(
                    'member-pdf',
                    () => generatePaymentHistoryPDF(memberPayments, member),
                    'PDF descargado',
                  )}
                >
                  <ExportIcon id="member-pdf" icon={FileText} />
                  {exporting === 'member-pdf' ? 'Generando PDF...' : 'PDF historial'}
                </button>
                <button
                  className="btn-secondary"
                  disabled={!!exporting}
                  onClick={() => runExport(
                    'member-excel',
                    () => generatePaymentHistoryExcel(memberPayments, member),
                    'Excel descargado',
                  )}
                >
                  <ExportIcon id="member-excel" icon={FileSpreadsheet} />
                  {exporting === 'member-excel' ? 'Generando Excel...' : 'Excel historial'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
