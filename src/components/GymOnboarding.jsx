import { Building2, ShieldCheck } from 'lucide-react'

// Este componente se conserva para que una copia antigua del repositorio no
// falle si todavía lo importa. El alta global de gimnasios no debe ejecutarse
// desde el navegador: cada administrador solo gestiona su propio gimnasio.
export function GymOnboarding() {
  return (
    <div className="card max-w-xl mx-auto text-center py-10">
      <span className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
        <Building2 className="w-7 h-7 text-brand-400" />
      </span>
      <h2 className="text-xl font-semibold text-white">Administración protegida</h2>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
        Los gimnasios se provisionan de forma segura fuera del panel público. Cada administrador solo puede consultar y modificar los datos de su propio gimnasio.
      </p>
      <p className="inline-flex items-center gap-2 text-xs text-emerald-400 mt-5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
        <ShieldCheck className="w-4 h-4" /> Aislamiento por gimnasio activo
      </p>
    </div>
  )
}

