# Conex Dash

Painel dos clientes da Conex (Vite + React + Supabase). Tema dark + azul Conex.

## Rodar local
1. `cp .env.example .env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (só a anon key).
2. `npm install`
3. `npm run dev`

Para ver o visual sem login, com dados fictícios: `VITE_DEMO=1 npm run dev`.

## Segurança
O isolamento entre clientes é feito pelo RLS do Supabase (`is_admin()` / `meu_cliente_id()`), nunca pelo app.
As views usam `security_invoker=true`. Nunca coloque a service_role no front.
