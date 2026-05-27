import { useState, useEffect, useCallback } from 'react'
import { Flame, Trophy, CheckCircle, Dumbbell, Star, Zap, Shield, Crown } from 'lucide-react'
import { playAchievementSound } from '../App'
import {
  supabase, markAttendance, removeAttendance, createNotification
} from '../supabase'
import { calculateStreak, today } from '../utils/helpers'

// ── LOGROS POR GÉNERO ─────────────────────────────────────
const getAchievements = (gender) => {
  const isFemale = gender === 'female'
  return [
    {
      id: 'spark',   days: 5,
      icon: '⚡',
      title:    isFemale ? 'Chispa'       : 'Chispa',
      subtitle: isFemale ? '¡Primera semana! Eres imparable.'  : '¡Primera semana completada!',
      color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30',
    },
    {
      id: 'fire',    days: 10,
      icon: '🔥',
      title:    isFemale ? 'En llamas'    : 'En llamas',
      subtitle: isFemale ? '¡10 días! La constancia te define.'  : '¡Dos semanas sin parar!',
      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30',
    },
    {
      id: 'warrior', days: 15,
      icon: isFemale ? '🦸‍♀️' : '💪',
      title:    isFemale ? 'Amazona'      : 'Guerrero',
      subtitle: isFemale ? '¡15 días de acero! Eres una amazona.' : '¡Tres semanas de hierro!',
      color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/30',
    },
    {
      id: 'month1',  days: 21,
      icon: isFemale ? '👸' : '🏆',
      title:    isFemale ? 'Wonder Woman' : 'Iron Man',
      subtitle: isFemale ? '¡Un mes! Eres una superheroína real.' : '¡Un mes entero de racha!',
      color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    },
    {
      id: 'month2',  days: 42,
      icon: '👑',
      title:    isFemale ? 'Reina'        : 'Leyenda',
      subtitle: isFemale ? '¡Dos meses! Reinas en el gimnasio.'  : '¡Dos meses sin rendirse!',
      color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30',
    },
    {
      id: 'month3',  days: 63,
      icon: '🌟',
      title:    isFemale ? 'Élite'        : 'Élite',
      subtitle: isFemale ? '¡Tres meses! Eres la inspiración.'   : '¡Tres meses de dedicación!',
      color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30',
    },
    {
      id: 'diamond', days: 126,
      icon: '💎',
      title: 'Diamante',
      subtitle: isFemale ? '¡Seis meses! Eres única e imparable.' : '¡Seis meses de superación!',
      color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30',
    },
  ]
}

// ── MENSAJES MOTIVACIONALES POR GÉNERO ────────────────────
const getMotivational = (streak, gender) => {
  const isFemale = gender === 'female'
  const msgs = [
    { min: 0,   emoji: '🚀', m: '¡Empieza hoy! Todo gran cambio comienza con un primer paso.',        f: '¡Empieza hoy! Todo gran cambio comienza con un primer paso.' },
    { min: 1,   emoji: '👣', m: '¡Buen comienzo! El primer paso es el más importante.',              f: '¡Buen comienzo! Tú puedes con todo.' },
    { min: 3,   emoji: '💫', m: '¡Buen ritmo! Ya estás formando el hábito.',                         f: '¡Buen ritmo! El hábito ya está tomando forma.' },
    { min: 5,   emoji: '🔥', m: '¡Una semana! Estás en fuego. ¡No pares!',                           f: '¡Una semana! Eres una guerrera. ¡No pares!' },
    { min: 10,  emoji: '⚡', m: '¡Imparable! Dos semanas de consistencia pura.',                     f: '¡Imparable! Dos semanas de pura dedicación.' },
    { min: 15,  emoji: '💪', m: '¡Tres semanas! Ya eres un guerrero del gimnasio.',                  f: '¡Tres semanas! Ya eres una amazona del gimnasio.' },
    { min: 21,  emoji: '🏆', m: '¡UN MES! ¡Eres una leyenda viviente!',                             f: '¡UN MES! ¡Eres una Wonder Woman real!' },
    { min: 42,  emoji: '👑', m: '¡DOS MESES! Pocos llegan hasta aquí. ¡Eres élite!',                f: '¡DOS MESES! Pocas llegan hasta aquí. ¡Eres élite!' },
    { min: 63,  emoji: '🌟', m: '¡TRES MESES! Eres la inspiración del gimnasio.',                   f: '¡TRES MESES! Eres la inspiración de todas.' },
  ]
  const found = [...msgs].reverse().find(m => streak >= m.min) || msgs[0]
  return { emoji: found.emoji, text: isFemale ? found.f : found.m }
}

// ── CELEBRACIÓN EN PANTALLA COMPLETA ──────────────────────
function CelebrationScreen({ achievement, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/95 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Partículas decorativas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['🎉','⭐','✨','🔥','💫','🌟','🎊','💥'].map((e, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-bounce"
            style={{
              left: `${10 + i * 12}%`,
              top:  `${15 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${0.8 + i * 0.1}s`,
            }}
          >{e}</span>
        ))}
      </div>

      {/* Contenido central */}
      <div className="text-center px-6 relative z-10">
        <div className="text-8xl mb-4 animate-bounce">{achievement.icon}</div>
        <p className="text-brand-400 font-semibold text-sm tracking-widest uppercase mb-2">
          ¡Logro desbloqueado!
        </p>
        <h2 className="text-4xl font-display tracking-wide text-white mb-3">
          {achievement.title}
        </h2>
        <p className="text-gray-300 text-lg mb-2">{achievement.subtitle}</p>
        <p className="text-gray-500 text-sm mb-8">
          ¡Llevas <span className="text-brand-400 font-bold">{achievement.days} días</span> de racha seguida!
        </p>

        {/* Barra decorativa */}
        <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl border ${achievement.bg} ${achievement.border}`}>
          <span className="text-xl">{achievement.icon}</span>
          <span className={`font-bold ${achievement.color}`}>{achievement.title}</span>
          <span className="text-xl">{achievement.icon}</span>
        </div>

        <p className="text-gray-600 text-xs mt-8">Toca para continuar</p>
      </div>
    </div>
  )
}

// ── ADVERTENCIA DE RACHA ──────────────────────────────────
function StreakWarning({ streak, markedToday }) {
  if (markedToday || streak === 0) return null
  const h = new Date().getHours()
  const remaining = 23 - h
  if (h < 18) return null

  return (
    <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 border
      ${h >= 21
        ? 'bg-red-500/10 border-red-500/30 animate-pulse-slow'
        : 'bg-yellow-500/10 border-yellow-500/20'}`}>
      <Flame className={`w-6 h-6 flex-shrink-0 ${h >= 21 ? 'text-red-400' : 'text-yellow-400'}`} />
      <div>
        <p className={`text-sm font-semibold ${h >= 21 ? 'text-red-400' : 'text-yellow-400'}`}>
          {h >= 21 ? `¡Solo quedan ~${remaining}h para salvar tu racha!` : '¡No olvides registrar tu asistencia hoy!'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Tienes una racha de <span className="text-white font-bold">{streak} días</span> en juego
        </p>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────
export function UserStreak({ attendance, member, onRefresh, profile }) {
  const [marking, setMarking]           = useState(false)
  const [celebration, setCelebration]   = useState(null) // achievement objeto

  const gender      = profile?.gender || 'male'
  const ACHIEVEMENTS = getAchievements(gender)

  const streak      = calculateStreak(attendance)
  const bestStreak  = member?.best_streak || 0
  const attended    = new Set(attendance.map(a => a.attended_date))
  const todayStr    = today()
  const markedToday = attended.has(todayStr)
  const motivational = getMotivational(streak, gender)

  const unlocked       = ACHIEVEMENTS.filter(a => streak >= a.days)
  const nextAchievement = ACHIEVEMENTS.find(a => streak < a.days)

  const handleToggleToday = async () => {
    if (!member) return
    setMarking(true)

    if (markedToday) {
      await removeAttendance(member.id, todayStr)
    } else {
      await markAttendance(member.id, todayStr)
      const newStreak = streak + 1

      // Actualizar mejor racha si se superó
      if (newStreak > bestStreak) {
        await supabase.from('members')
          .update({ best_streak: newStreak })
          .eq('id', member.id)
      }

      // Verificar logro
      const newAchievement = ACHIEVEMENTS.find(a => newStreak === a.days)
      if (newAchievement) {
        playAchievementSound()
        setCelebration(newAchievement)
        await createNotification({
          profile_id: profile.id,
          type: 'custom',
          title: `${newAchievement.icon} ¡Logro: ${newAchievement.title}!`,
          message: `${newAchievement.subtitle} Llevas ${newAchievement.days} días seguidos.`,
        })
      }
    }

    onRefresh()
    setMarking(false)
  }

  // ── CALENDARIO 35 días ────────────────────────────────
  const calDays = []
  for (let i = 34; i >= 0; i--) {
    const d   = new Date()
    d.setDate(d.getDate() - i)
    const str = d.toISOString().split('T')[0]
    const dow = d.getDay()
    calDays.push({
      date:       str,
      dow,
      didAttend:  attended.has(str),
      isSunday:   dow === 0,
      isSaturday: dow === 6,
      isToday:    str === todayStr,
      isFuture:   str > todayStr,
      isMissed:   dow !== 0 && dow !== 6 && str < todayStr && str !== todayStr && !attended.has(str),
    })
  }
  const offset     = calDays[0].dow === 0 ? 6 : calDays[0].dow - 1
  const emptySlots = Array(offset).fill(null)

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">

      {/* Celebración pantalla completa */}
      {celebration && (
        <CelebrationScreen
          achievement={celebration}
          onClose={() => setCelebration(null)}
        />
      )}

      <h2 className="section-title">Mi racha 🔥</h2>

      {/* Advertencia de racha */}
      <StreakWarning streak={streak} markedToday={markedToday} />

      {/* Contador principal */}
      <div className="card text-center py-7 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
          <Flame className="w-64 h-64 text-brand-500" />
        </div>
        <div className="relative">
          {/* Llama grande */}
          <div className="flex justify-center mb-2">
            <Flame
              className={`w-14 h-14 transition-all duration-500 ${
                markedToday
                  ? 'text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.7)]'
                  : streak > 0 ? 'text-gray-500' : 'text-gray-700'
              }`}
              fill={markedToday ? 'currentColor' : 'none'}
            />
          </div>

          <div className="text-7xl font-display tracking-wider text-brand-400 leading-none">
            {streak}
          </div>
          <p className="text-gray-300 font-medium mt-1">días de racha</p>
          <p className="text-sm mt-3 text-gray-400">
            {motivational.emoji} {motivational.text}
          </p>

          {/* Mejor racha */}
          {bestStreak > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-600">
              <Trophy className="w-3 h-3" />
              Mejor racha: <span className="text-gray-400 font-semibold ml-1">{bestStreak} días</span>
              {streak >= bestStreak && streak > 0 && (
                <span className="text-brand-400 font-semibold ml-1">¡Récord!</span>
              )}
            </div>
          )}

          {/* Próximo logro */}
          {nextAchievement && streak > 0 && (
            <div className="mt-3 mx-auto max-w-xs bg-gray-800/50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-500">
                Próximo logro en <span className="text-brand-400 font-bold">{nextAchievement.days - streak} días</span>
              </p>
              <div className="mt-1.5 bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-brand-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (streak / nextAchievement.days) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                {nextAchievement.icon} {nextAchievement.title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Botón marcar */}
      <button
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95 duration-150
          ${markedToday
            ? 'bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400'
            : 'btn-primary text-lg'}`}
        onClick={handleToggleToday}
        disabled={marking}
      >
        {marking
          ? <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          : markedToday
            ? <><CheckCircle className="w-5 h-5" /> ¡Entrenamiento de hoy completado!</>
            : <><Dumbbell className="w-5 h-5" /> Marcar asistencia de hoy</>
        }
      </button>

      {/* Calendario visual */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-400">Últimos 35 días</p>
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-500 inline-block" /> Fui
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-950 border border-red-900/50 inline-block" /> Fallé
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-800/30 border border-dashed border-gray-700 inline-block" /> Opcional
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="text-center text-[10px] text-gray-600 font-semibold pb-1">{d}</div>
          ))}
          {emptySlots.map((_, i) => <div key={`e${i}`} />)}
          {calDays.map(d => {
            let cls = 'bg-gray-800/20 text-gray-700'

            if (d.isSunday)
              cls = 'opacity-20 text-gray-800'
            else if (d.isFuture)
              cls = 'bg-gray-800/10 text-gray-800'
            else if (d.didAttend)
              cls = 'bg-brand-500 text-white font-bold shadow-sm shadow-brand-500/50'
            else if (d.isMissed)
              cls = 'bg-red-950 border border-red-900/40 text-red-800'
            else if (d.isSaturday)
              cls = 'bg-gray-800/20 text-gray-600 border border-dashed border-gray-700/50'
            else if (d.isToday)
              cls = 'border-2 border-brand-500 text-brand-400 font-bold'

            return (
              <div
                key={d.date}
                title={d.date}
                className={`aspect-square rounded-lg flex items-center justify-center text-[10px] transition-all ${cls}`}
              >
                {d.isSunday ? '·' : new Date(d.date + 'T12:00:00').getDate()}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-700 text-center mt-2">
          Domingos no cuentan · Sábados son opcionales
        </p>
      </div>

      {/* Logros */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-amber-400" />
          Logros
          <span className="text-xs text-gray-500 font-normal ml-auto">
            {unlocked.length}/{ACHIEVEMENTS.length} desbloqueados
          </span>
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a => {
            const done = streak >= a.days
            const isNext = nextAchievement?.id === a.id
            return (
              <div
                key={a.id}
                className={`rounded-2xl border px-3 py-3 transition-all relative overflow-hidden
                  ${done
                    ? `${a.bg} ${a.border}`
                    : isNext
                      ? 'bg-gray-800/30 border-gray-700 border-dashed'
                      : 'bg-gray-800/10 border-gray-800/50 opacity-35'}`}
              >
                {isNext && !done && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded-full">Siguiente</span>
                  </div>
                )}
                <div className="text-2xl mb-1.5">{a.icon}</div>
                <p className={`text-sm font-bold leading-tight ${done ? a.color : isNext ? 'text-gray-300' : 'text-gray-600'}`}>
                  {a.title}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{a.subtitle}</p>
                <p className={`text-[10px] mt-1.5 font-semibold ${done ? a.color : 'text-gray-600'}`}>
                  {done ? '✓ Desbloqueado' : `${a.days} días`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
