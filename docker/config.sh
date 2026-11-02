#!/bin/sh
# Roda quando o container liga: grava /config.js com as variáveis de ambiente públicas
# (URL do Supabase e a anon/publishable key). Nunca coloque a service_role aqui.
set -e
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
cat > /usr/share/nginx/html/config.js <<JS
window.__CONEX_CONFIG__ = {
  VITE_SUPABASE_URL: "$(esc "${VITE_SUPABASE_URL:-}")",
  VITE_SUPABASE_ANON_KEY: "$(esc "${VITE_SUPABASE_ANON_KEY:-}")"
}
JS
echo "config.js gerado (URL definida: $([ -n "${VITE_SUPABASE_URL:-}" ] && echo sim || echo NAO))"
