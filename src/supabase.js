import { createClient } from '@supabase/supabase-js'

export const DEMO = import.meta.env.VITE_DEMO === '1'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && key)

export const supabase = configurado
  ? createClient(url, key)
  : null
