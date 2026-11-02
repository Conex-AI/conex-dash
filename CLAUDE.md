# Conex Dash — contexto do projeto

Painel para clientes da Conex (consultoria de automações WhatsApp com n8n). Cada cliente vê o atendimento do agente dele; o admin (Vini) vê todos. Cliente piloto: **Ju Beauty** (agente "Jú", da Juliana).

## Stack
- Vite + React (SPA), `@supabase/supabase-js`, `recharts`. Sem backend próprio.
- Deploy: Dockerfile (build Vite → nginx) no EasyPanel. Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` entram no **build** (são públicas).
- Idioma de toda a interface e dos textos: português do Brasil. Datas no fuso `America/Sao_Paulo`.

## Segurança (regra de ouro)
- O isolamento entre clientes é feito **só pelo RLS do Supabase**, nunca pelo app.
- Nunca usar `service_role`/secret key no front. Só a anon/publishable key.
- Policies de leitura usam `is_admin()` e `meu_cliente_id()` (funções `security definer`). `perfis.papel = 'admin'` para admin; qualquer outro valor (usamos `'cliente'`) vê só o `cliente_id` do perfil.
- Views e funções com `security invoker` para o RLS valer (`security_invoker = true`).
- Sem linha em `perfis` o usuário não vê nada (comportamento desejado).

## Banco (Supabase `conex-dash`)
Tabelas: `clientes` (id, slug, nome, followup_ativo, ativo), `perfis` (user_id, papel, cliente_id), `mensagens` (cliente_id, telefone, nome_wpp, direcao, origem cliente|ia|humano, tipo, conteudo, dedupe_key, created_at), `eventos_conversa` (cliente_id, telefone, evento, motivo, estagio, procedimento, valor, meta jsonb, dedupe_key, created_at).

Eventos que existem: `contato_novo`, `procedimento_definido`, `horario_definido`, `transferencia_esperada`, `comprovante_recebido`, `conversao`; previstos: `transferencia_falha`, `resolvida_sem_humano`, `followup_enviado` (estagio 1/2/3 — o fluxo ainda NÃO grava este; follow-up da Ju Beauty está desativado).

Views/funções: `v_conversas_resumo`, `v_conversoes` (conversão só conta se houve `transferencia_esperada` antes), `v_followup_elegiveis`, `v_metricas_diarias` (por cliente/dia), `v_followup_dia`, função `funil_periodo(p_cliente, p_de, p_ate)` (pessoas distintas no período, na etapa mais avançada) e `dashboard_periodo(p_cliente, p_de, p_ate)` (jsonb com funil, desfechos, motivos, horas, procedimentos, pix e mensagens; security invoker; é o que o Dashboard usa).

## Definições das métricas
- **Repasse esperado conta como sucesso** (a IA passar para a Juliana no momento certo é resultado, não falha).
- Taxa de sucesso = (repasses_esperados + resolvidas_sem_humano) / conversas do período (segue o protótipo).
- Conversão = agendamentos confirmados / conversas. Agendamento = Juliana confirmou ("Agendamento confirmado!") após um repasse esperado.
- Follow-up: conversão atribuída se ocorrer até 48h depois do último follow-up enviado.
- Funil: Contatos → Procedimento → Horário → Comprovante → Agendamento (cada pessoa conta uma vez; quem chegou longe conta nas etapas anteriores).

## Visual
Tema dark grafite + azul Conex. Tokens em `src/theme.css`: fundo `#16181D`, cards `#1E2128`, azul `#0A57FC`. Não usar preto puro. Logo em `public/logo-conex.png` (fundo transparente).

## Estado das abas
Prontas: Dashboard (layout do protótipo, dados via função `dashboard_periodo` em `sql/dashboard_periodo.sql`), Conversas (3 painéis: lista, chat e detalhes com linha do tempo; lê `mensagens` e `eventos_conversa` pelo RLS). Faltam (hoje `EmBreve`): Métricas, Pix, Follow-up, Clientes (só admin). Protótipo de todas as 6 telas: https://claude.ai/artifact/71fpWMs7942KSqvUNdiSHB (tema claro; o app usa os mesmos layouts com os tokens dark).

## Convenções
- Leitura de dados só em `src/api.js`; cálculo de métricas em `src/lib/metricas.js`.
- `VITE_DEMO=1` roda com dados fictícios (`src/demo.js`) para ver o visual sem login.
- Mensagens de erro para o cliente final: simples, em português, sem jargão.
- Mudanças de banco: sempre como SQL para o Vini rodar no SQL Editor; explicar o motivo.
