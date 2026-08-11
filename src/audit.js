import { supabase } from './supabase'

export const getAuditEvents = async (limit = 500) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 500)
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit)
  return { data, error }
}

// Solo admite las acciones de cuenta validadas en Supabase. Los errores de
// bitácora no deben impedir iniciar/cerrar sesión o cambiar una contraseña.
export const recordMyAuditEvent = async (action, details = {}) => {
  try {
    return await supabase.rpc('record_my_audit_event', {
      p_action: action,
      p_details: details,
    })
  } catch (error) {
    return { data: null, error }
  }
}
