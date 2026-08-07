import { Dumbbell } from 'lucide-react'

/**
 * Identidad del gimnasio para los encabezados.
 *
 * El contenedor no tiene un ancho fijo: toma la proporción natural del logo,
 * con límites seguros para que tanto un emblema cuadrado como un logo
 * horizontal se vean grandes sin deformarse ni empujar los botones del header.
 */
export function GymBrand({ logoUrl, gymName, areaLabel, onLogoError }) {
  const name = gymName || import.meta.env.VITE_GYM_NAME || 'Control Gym'

  return (
    <div className="flex items-center gap-2.5 min-w-0" aria-label={`${name} · ${areaLabel}`}>
      {logoUrl ? (
        <div className="h-12 min-w-12 max-w-[140px] rounded-xl bg-gray-950/70 border border-gray-700/90 shadow-[0_8px_24px_rgba(0,0,0,0.32)] p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
          <img
            src={logoUrl}
            alt={`Logo de ${name}`}
            title={name}
            className="block max-h-full max-w-[136px] w-auto h-auto rounded-[10px] object-contain"
            onError={onLogoError}
          />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center flex-shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <Dumbbell className="w-6 h-6 text-brand-400" />
        </div>
      )}

      <div className={`min-w-0 ${logoUrl ? 'hidden min-[430px]:block' : ''}`}>
        <p className="font-display text-lg leading-tight tracking-wide text-white truncate">
          {name}
        </p>
        <p className="text-[10px] leading-tight uppercase tracking-[0.15em] text-gray-500 truncate mt-0.5">
          {areaLabel}
        </p>
      </div>
    </div>
  )
}
