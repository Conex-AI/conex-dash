# Conex Dash — contexto do projeto

Painel para clientes da Conex (consultoria de automações WhatsApp com n8n). Cada cliente vê o atendimento do agente dele; o admin (Vini) vê todos. Cliente piloto: **Ju Beauty** (agente "Jú", da Juliana).

## Stack
- Vite + React (SPA), `@supabase/supabase-js`, `recharts`. Sem backend próprio.
- Deploy: Dockerfile (build Vite → nginx) no EasyPanel. `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (públicas) são lidas quando o container liga: `docker/config.sh` grava `/config.js` (`window.__CONEX_CONFIG__`); em dev vale o `.env`. Mudou variável → reiniciar o app, sem rebuild.
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
Tema escuro (padrão: grafite + azul Conex) e tema claro (`:root[data-theme="claro"]`), escolhidos no Perfil e salvos no navegador (`src/lib/tema.js`). Tokens em `src/theme.css`: fundo `#16181D`, cards `#1E2128`, azul `#0A57FC`. Não usar preto puro; cores sempre por variável (gráficos seguem o tema por CSS). Logo: `src/components/Marca.jsx`, vetorizada da logo oficial (símbolo + CONEX); "DASH" desenhado no mesmo traço. A parte preta usa `currentColor`.

## Estado das abas
Todas prontas, no layout do protótipo (https://claude.ai/artifact/71fpWMs7942KSqvUNdiSHB, tema claro; o app usa os mesmos layouts com os tokens dark):
- Dashboard → `dashboard_periodo` (`sql/dashboard_periodo.sql`).
- Conversas → lista, chat (busca as 2000 mensagens mais recentes) e detalhes com linha do tempo; lê `mensagens` e `eventos_conversa`.
- Métricas → `metricas_periodo` + `dashboard_periodo`; Pix → `pix_periodo`; Follow-up → `followup_periodo`; Clientes (só admin) → `clientes_resumo`, `admin_acessos`, `admin_vincular_acesso` (security definer, só admin), insert em `clientes` (policy `clientes_admin_insert`). Tudo em `sql/telas.sql`.
- "Sinal solicitado" no Pix = mensagem da Jú que menciona Pix (não há evento próprio). Divergência de comprovante e sinais de incômodo do follow-up ainda não são registrados pelo fluxo.
- Perfil (`/perfil`, botão com o nome do cliente no menu): foto do painel (Storage `fotos/<cliente_id>/`, `clientes.foto_url`, função `definir_foto_cliente`; SQL em `sql/perfil.sql`), tema claro/escuro e troca de senha (confere a atual antes).
- Redefinir senha usa `resetPasswordForEmail`; o link volta ao app e abre `NovaSenha.jsx` (evento PASSWORD_RECOVERY). A URL do app precisa estar em Supabase › Authentication › URL Configuration.

## Convenções
- Leitura de dados só em `src/api.js`; cálculo de métricas em `src/lib/metricas.js`.
- Cache e pré-carga com TanStack Query (`src/lib/consultas.js`): toda tela busca dados por `useDados(consultasDaAba(...))` ou `q.*`, nunca `useEffect` + fetch. staleTime 1 min; ao entrar o app pré-carrega todas as abas, e o hover no menu pré-carrega a aba. Placeholder só reaproveita dados do mesmo cliente. Telas (exceto Dashboard) são `lazy` e baixadas em segundo plano; bibliotecas em chunks separados (`vite.config.js`).
- Navegação por endereço (`src/lib/rota.js`): `/aba?cliente=slug`, cada troca de aba ou de cliente vai para o histórico (voltar do navegador e botões do mouse funcionam). Menu usa `<a href>`; nginx manda qualquer rota para o index.html.
- Período (`src/components/Periodo.jsx`), compartilhado entre as abas (sessionStorage); ano só aparece quando o intervalo cruza anos. Computador: datas ("4 OUT → 2 NOV") + 7/30/90 dias + ícone de calendário (dois meses, com atalhos). Celular (≤860px): um botão só ("Últimos 30 dias") que abre menu com as opções e "Escolher datas…" (calendário compacto de um mês).
- Blocos de métricas reaproveitados entre Dashboard e Métricas em `src/components/Blocos.jsx`. A tela Métricas reúne TODAS as métricas do painel (visão geral, atendimento, repasses, agendamento, horários, Pix, follow-up). Motivos do fluxo vêm como código (`comprovante_pix`) e são traduzidos por `rotuloMotivo`.
- Celular (≤860px): barra no topo (menu, logo, foto → perfil) e menu em gaveta (`src/lib/gaveta.js`): abre pelo botão ou arrastando da borda esquerda ou direita (sai do lado puxado e segue o dedo); fecha arrastando, tocando fora, Esc ou ao escolher uma tela.
- `VITE_DEMO=1` roda com dados fictícios (`src/demo.js`) para ver o visual sem login.
- Mensagens de erro para o cliente final: simples, em português, sem jargão.
- Mudanças de banco: sempre como SQL para o Vini rodar no SQL Editor; explicar o motivo.
