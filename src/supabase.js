import { createClient } from '@supabase/supabase-js'

export const DEMO = import.meta.env.VITE_DEMO === '1'

// A configuração vem de /config.js, gerado quando o container liga (docker/config.sh),
// a partir das variáveis de ambiente do EasyPanel. Em desenvolvimento local vale o .env.
const cfg = (typeof window !== 'undefined' && window.__CONEX_CONFIG__) || {}
const url = cfg.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const key = cfg.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && key)

export const supabase = configurado
  ? createClient(url, key)
  : null
