import { useState, useEffect } from 'react'
import { CheckCircle, Flame, AlertCircle, XCircle, Dumbbell, LogIn } from 'lucide-react'
import { supabase, getMyGym, getAttendance, markAttendance } from '../supabase'
import { today, calculateStreak, getMemberPaymentStatus } from '../utils/helpers'
import Login from './Login'

// Estados posibles del check-in
// 'working' | 'success' | 'already' | 'wrong_gym' | 'no_member' | 'admin' | 'error'

export function CheckIn({ code, profile, onExit }) {
  const [state, setState]   = useState('working')
  const [streak, setStreak] = useState(0)
  const [gymName, setGymName] = useState('')
  const [overdue, setOverdue] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    const run = async () => {
      try {
        // 1) Cargar el gimnasio del propio usuario y validar el código
        const { data: gym } = await getMyGym(profile.gym_id)
        if (cancelled) return
        if (!gym) { setState('error'); return }
        setGymName(gym.name)

        if (gym.checkin_code !== code) { setState('wrong_gym'); return }

        // Config de racha del gimnasio (días cerrados / festivos)
        const opts = {
          closedWeekdays: gym.closed_weekdays || [0, 6],
          holidays: Array.isArray(gym.holidays) ? gym.holidays : [],
        }

        // 2) Los admins no tienen ficha de miembro
        if (profile.role === 'admin') { setState('admin'); return }

        // 3) Buscar la ficha de miembro
        const { data: member } = await supabase
          .from('members')
          .select('*, plan:plans(*)')
          .eq('profile_id', profile.id)
          .single()
        if (cancelled) return
        if (!member) { setState('no_member'); return }

        // Nota de cuota vencida (no bloquea el check-in)
        const { data: payments } = await supabase
          .from('payments').select('*').eq('member_id', member.id)
        if (cancelled) return
        setOverdue(getMemberPaymentStatus(member, payments || []) === 'overdue')

        // 4) ¿Ya registró hoy?
        const { data: attendance } = await getAttendance(member.id)
        if (cancelled) return
        const todayStr = today()
        const already  = (attendance || []).some(a => a.attended_date === todayStr)

        if (already) {
          setStreak(calculateStreak(attendance || [], opts))
          setState('already')
          return
        }

        // 5) Registrar asistencia de hoy
        await markAttendance(member.id, todayStr)
        const { data: fresh } = await getAttendance(member.id)
        if (cancelled) return
        const newStreak = calculateStreak(fresh || [], opts)
        setStreak(newStreak)

        // Actualizar mejor racha si se superó
        if (newStreak > (member.best_streak || 0)) {
          await supabase.from('members')
            .update({ best_streak: newStreak })
            .eq('id', member.id)
        }

        setState('success')
      } catch {
        if (!cancelled) setState('error')
      }
    }

    run()
    return () => { cancelled = true }
  }, [profile, code])

  // ── Sin sesión: pedir login (el código se conserva en la URL) ──
  if (!profile) {
    return (
      <div className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-6 max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500/10 border border-brand-500/30 rounded-2xl mb-3">
            <LogIn className="w-7 h-7 text-brand-500" />
          </div>
          <h1 className="text-xl font-semibold text-white">Inicia sesión para registrar tu asistencia</h1>
          <p className="text-gray-500 text-sm mt-1">Tu check-in se completará en cuanto entres.</p>
        </div>
        <Login />
      </div>
    )
  }

  // ── Pantallas de resultado ──
  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="card text-center">
          {state === 'working' && (
            <div className="py-8">
              <div className="w-10 h-10 border-2 border-gray-800 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Registrando tu asistencia...</p>
            </div>
          )}

          {state === 'success' && (
            <div className="py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-3">
                <CheckCircle className="w-9 h-9 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold text-white">¡Asistencia registrada!</h1>
              <p className="text-gray-500 text-sm mt-1">{gymName}</p>
              <div className="flex items-center justify-center gap-2 mt-5 bg-orange-500/10 border border-orange-500/20 rounded-xl py-3">
                <Flame className="w-6 h-6 text-orange-400" />
                <span className="text-2xl font-bold text-white">{streak}</span>
                <span className="text-gray-400 text-sm">{streak === 1 ? 'día seguido' : 'días seguidos'}</span>
              </div>
              {overdue && (
                <p className="text-yellow-400/90 text-xs mt-4 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Tu cuota está vencida, regulariza en recepción.
                </p>
              )}
            </div>
          )}

          {state === 'already' && (
            <div className="py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500/10 border border-brand-500/30 rounded-2xl mb-3">
                <Flame className="w-9 h-9 text-brand-500" />
              </div>
              <h1 className="text-xl font-semibold text-white">Ya registraste hoy</h1>
              <p className="text-gray-500 text-sm mt-1">Llevas {streak} {streak === 1 ? 'día seguido' : 'días seguidos'}. ¡Sigue así!</p>
            </div>
          )}

          {state === 'wrong_gym' && (
            <div className="py-6">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-white">Este código no es de tu gimnasio</h1>
              <p className="text-gray-500 text-sm mt-1">Escanea el QR de tu propio gimnasio para registrarte.</p>
            </div>
          )}

          {state === 'no_member' && (
            <div className="py-6">
              <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-white">No tienes ficha de miembro</h1>
              <p className="text-gray-500 text-sm mt-1">Habla con tu gimnasio para que te registre.</p>
            </div>
          )}

          {state === 'admin' && (
            <div className="py-6">
              <Dumbbell className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-white">Eres administrador</h1>
              <p className="text-gray-500 text-sm mt-1">El check-in es para los miembros del gimnasio.</p>
            </div>
          )}

          {state === 'error' && (
            <div className="py-6">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h1 className="text-lg font-semibold text-white">Algo salió mal</h1>
              <p className="text-gray-500 text-sm mt-1">Intenta escanear de nuevo en un momento.</p>
            </div>
          )}

          {state !== 'working' && (
            <button className="btn-primary w-full mt-6" onClick={onExit}>
              Ir a la app
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
