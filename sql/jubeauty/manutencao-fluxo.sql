-- =============================================================================
-- JU BEAUTY — SQL de manutenção do fluxo da Jú (n8n)
-- =============================================================================
-- ONDE RODAR: SQL Editor do projeto Supabase "jubeauty" (o banco do fluxo).
--             NÃO é o projeto conex-dash (o do painel) — exceto a seção 9.
-- Rode um bloco por vez.
--
-- NÚMERO: sempre 55 + DDD + número, só dígitos. Ex.: 556193398630
--   O fluxo grava como 556193398630@s.whatsapp.net; as consultas usam "começa com",
--   então funcionam com ou sem o @s.whatsapp.net.
--   Nos blocos "do $$ ... $$" troque o número só na linha  v_numero text := '...'.
--
-- ONDE A JÚ GUARDA CADA COISA:
--   n8n_chat_histories  → memória da Jú (o que ela "lembra" da conversa)
--   chat_messages       → histórico de mensagens (usado no resumo para a Juliana)
--   chats               → última conversa (define cliente NOVO x DE RETORNO e o follow-up)
--   dados_cliente       → cadastro do contato + estado da IA (ativa / pausada)
--   pix_pendente        → sinais/comprovantes (pendente ou confirmado)
--   lembretes_pendentes → lembretes de agendamento já enviados
--   documents           → base de conhecimento (RAG) — NUNCA apague nas limpezas
--   Redis (fora do SQL) → mensagens picotadas esperando resposta (chave jubeauty:<número>@s.whatsapp.net)
-- =============================================================================


-- =============================================================================
-- 0. BACKUP DO BANCO DA JÚ (faça antes de limpar; fica num schema que a API não expõe)
-- =============================================================================
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

do $$
declare s text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MI');
        t text;
begin
  foreach t in array array['dados_cliente','chats','chat_messages','n8n_chat_histories','pix_pendente','lembretes_pendentes'] loop
    execute format('create table backup.%I as select * from public.%I', t || '_' || s, t);
  end loop;
  raise notice 'Backup criado com o final: %', s;
end $$;

-- Ver os backups
select table_name from information_schema.tables where table_schema = 'backup' order by table_name;

-- Restaurar a memória e o histórico de UM número a partir de um backup (troque <data> e o número)
insert into public.n8n_chat_histories select * from backup."n8n_chat_histories_<data>" where session_id like '556193398630%' on conflict do nothing;
insert into public.chat_messages      select * from backup."chat_messages_<data>"      where phone      like '556193398630%' on conflict do nothing;


-- =============================================================================
-- 1. CONSULTAR
-- =============================================================================

-- 1.1 Situação completa de um número (troque o número nas 6 linhas — Ctrl+H no editor)
select 'cadastro' as onde, telefone, nomewpp as detalhe, atendimento_ia as estado, created_at from dados_cliente where telefone like '556193398630%'
union all select 'ultima conversa', phone, followup, null, updated_at from chats where phone like '556193398630%'
union all select 'memoria da Jú', '556193398630', count(*)::text || ' mensagens', null, null from n8n_chat_histories where session_id like '556193398630%'
union all select 'historico', '556193398630', count(*)::text || ' mensagens', null, max(created_at) from chat_messages where phone like '556193398630%'
union all select 'pix', telefone, nome, status, confirmado_em from pix_pendente where telefone like '556193398630%';

-- 1.2 Quem está com a IA pausada agora (e desde quando)
select telefone, nomewpp, atendimento_ia, transferido_em, humano_respondeu_em, cliente_respondeu_em
from dados_cliente
where atendimento_ia like 'pause%'
order by greatest(transferido_em, humano_respondeu_em, cliente_respondeu_em) desc nulls last;

-- 1.3 Pix pendentes (comprovante recebido, Juliana ainda não confirmou)
select * from pix_pendente where status <> 'confirmado' order by id desc;

-- 1.4 Últimas mensagens de um número (o que a Jú e a cliente disseram)
select created_at at time zone 'America/Sao_Paulo' as quando, user_message as cliente, bot_message as ju, message_type
from chat_messages where phone like '556193398630%' order by created_at desc limit 30;

-- 1.5 Contatos mais recentes
select telefone, nomewpp, atendimento_ia, created_at at time zone 'America/Sao_Paulo' as primeiro_contato
from dados_cliente order by created_at desc limit 30;


-- =============================================================================
-- 2. IA: PAUSAR / DESPAUSAR
-- =============================================================================

-- 2.1 Despausar UM número (a Jú volta a responder na próxima mensagem da cliente)
update dados_cliente
set atendimento_ia = 'reativada', transferido_em = null, humano_respondeu_em = null, cliente_respondeu_em = null
where telefone like '556193398630%';

-- 2.2 Despausar TODOS
update dados_cliente
set atendimento_ia = 'reativada', transferido_em = null, humano_respondeu_em = null, cliente_respondeu_em = null
where atendimento_ia like 'pause%';

-- 2.3 Pausar UM número manualmente (a Jú para de responder até ser despausada
--     pela frase "Agendamento confirmado" ou pela liberação automática de 24h)
update dados_cliente set atendimento_ia = 'pause', transferido_em = now() where telefone like '556193398630%';


-- =============================================================================
-- 3. APAGAR SÓ A MEMÓRIA DE UM NÚMERO
--    A Jú esquece a conversa, mas a pessoa continua cadastrada (vira cliente de retorno).
-- =============================================================================
do $$
declare v_numero text := '556193398630';
        n int;
begin
  delete from n8n_chat_histories where session_id like v_numero || '%'; get diagnostics n = row_count; raise notice 'memória: % linhas', n;
  delete from chat_messages      where phone      like v_numero || '%'; get diagnostics n = row_count; raise notice 'histórico: % linhas', n;
end $$;
-- + Redis do mesmo número (seção 8)


-- =============================================================================
-- 4. TRATAR UM NÚMERO COMO CLIENTE NOVO (como se nunca tivesse falado com a Jú)
--    Próxima mensagem: saudação de primeiro contato, cadastro criado de novo.
-- =============================================================================
do $$
declare v_numero text := '556193398630';
        n int;
begin
  delete from n8n_chat_histories  where session_id like v_numero || '%'; get diagnostics n = row_count; raise notice 'memória: %', n;
  delete from chat_messages       where phone      like v_numero || '%'; get diagnostics n = row_count; raise notice 'histórico: %', n;
  delete from chats               where phone      like v_numero || '%'; get diagnostics n = row_count; raise notice 'chats: %', n;
  delete from pix_pendente        where telefone   like v_numero || '%'; get diagnostics n = row_count; raise notice 'pix: %', n;
  delete from lembretes_pendentes where remote_jid like v_numero || '%'; get diagnostics n = row_count; raise notice 'lembretes: %', n;
  delete from dados_cliente       where telefone   like v_numero || '%'; get diagnostics n = row_count; raise notice 'cadastro: %', n;
end $$;
-- + Redis do mesmo número (seção 8)
-- + se quiser que ele também suma do painel: seção 9 (no projeto conex-dash)


-- =============================================================================
-- 5. RESETAR A CONVERSA MANTENDO COMO CLIENTE DE RETORNO
--    Apaga memória, histórico e pendências; mantém o cadastro e marca a última conversa
--    como antiga → a próxima mensagem cai na saudação de "cliente de retorno".
-- =============================================================================
do $$
declare v_numero text := '556193398630';
begin
  delete from n8n_chat_histories where session_id like v_numero || '%';
  delete from chat_messages      where phone      like v_numero || '%';
  delete from pix_pendente       where telefone   like v_numero || '%' and status <> 'confirmado';
  update chats set updated_at = now() - interval '2 days' where phone like v_numero || '%';
  update dados_cliente
     set atendimento_ia = 'reativada', transferido_em = null, humano_respondeu_em = null, cliente_respondeu_em = null
   where telefone like v_numero || '%';
end $$;

-- 5b. (opcional) Fazer o resumo para a Juliana mostrar "Cliente recorrente · 1 agendamento"
insert into pix_pendente (telefone, nome, status, confirmado_em)
values ('556193398630@s.whatsapp.net', 'Teste', 'confirmado', now() - interval '30 days');


-- =============================================================================
-- 6. VÁRIOS NÚMEROS DE UMA VEZ (ex.: todos os seus números de teste)
--    Mesmo efeito da seção 4 (cliente novo) para cada número da lista.
-- =============================================================================
do $$
declare v_numeros text[] := array['556193398630', '556184834436'];   -- adicione quantos quiser
        p text[];
begin
  p := array(select x || '%' from unnest(v_numeros) x);
  delete from n8n_chat_histories  where session_id like any (p);
  delete from chat_messages       where phone      like any (p);
  delete from chats               where phone      like any (p);
  delete from pix_pendente        where telefone   like any (p);
  delete from lembretes_pendentes where remote_jid like any (p);
  delete from dados_cliente       where telefone   like any (p);
  raise notice 'Limpos: %', v_numeros;
end $$;


-- =============================================================================
-- 7. TODOS OS NÚMEROS — ZERAR A JÚ (ex.: antes de ir ao ar). Faça o backup (seção 0) antes!
--    Mantém a base de conhecimento (documents) e a estrutura das tabelas.
-- =============================================================================

-- 7.1 Só a memória de todo mundo (todos viram cliente de retorno)
begin;
delete from n8n_chat_histories;
delete from chat_messages;
commit;

-- 7.2 Tudo de todo mundo (todos viram cliente novo)
begin;
delete from n8n_chat_histories;
delete from chat_messages;
delete from chats;
delete from pix_pendente;
delete from lembretes_pendentes;
delete from dados_cliente;
commit;
-- + Redis de todos os números (seção 8.3)

-- 7.3 Conferência
select (select count(*) from n8n_chat_histories) as memoria, (select count(*) from chat_messages) as historico,
       (select count(*) from chats) as chats, (select count(*) from dados_cliente) as contatos,
       (select count(*) from pix_pendente) as pix, (select count(*) from lembretes_pendentes) as lembretes,
       (select count(*) from documents) as base_conhecimento_intacta;


-- =============================================================================
-- 8. REDIS (não é SQL) — mensagens picotadas que ainda estão esperando resposta
--    Se não limpar, a Jú pode responder a uma mensagem antiga logo depois de você limpar o banco.
--    Onde: EasyPanel → serviço redis → Console. Se a credencial "Redis" do n8n usa um
--    Database diferente de 0, acrescente  -n <número>  depois de redis-cli.
--    Se o Redis tiver senha:  redis-cli -a '<senha>' ...
-- =============================================================================
-- 8.1 Um número:
--   redis-cli DEL "jubeauty:556193398630@s.whatsapp.net"
-- 8.2 Vários números:
--   redis-cli DEL "jubeauty:556193398630@s.whatsapp.net" "jubeauty:556184834436@s.whatsapp.net"
-- 8.3 Todos os números da Ju Beauty (não mexe nos outros clientes, só no prefixo jubeauty:):
--   redis-cli --scan --pattern 'jubeauty:*' | xargs -r redis-cli DEL
-- 8.4 Ver o que está guardado agora:
--   redis-cli --scan --pattern 'jubeauty:*'


-- =============================================================================
-- 9. PAINEL (rodar no projeto Supabase "conex-dash", NÃO no jubeauty)
--    Para o número sumir também do Conex Dash (Conversas, métricas).
-- =============================================================================
do $$
declare v_numero text := '556193398630';
        v_cliente uuid := (select id from clientes where slug = 'jubeauty');
begin
  delete from eventos_conversa where cliente_id = v_cliente and telefone like v_numero || '%';
  delete from mensagens        where cliente_id = v_cliente and telefone like v_numero || '%';
end $$;
-- Para zerar o painel inteiro da Ju Beauty: seção 4 do sql/manutencao.sql (repositório conex-dash).


-- =============================================================================
-- 10. PIX E LEMBRETES
-- =============================================================================

-- 10.1 Apagar Pix de teste que ficaram pendentes
delete from pix_pendente where status = 'pendente' and telefone like '556193398630%';

-- 10.2 Marcar um Pix como confirmado manualmente (se a Juliana confirmou fora do fluxo)
update pix_pendente set status = 'confirmado', confirmado_em = now()
where telefone like '556193398630%' and status <> 'confirmado';

-- 10.3 Apagar lembretes já registrados de um número (para o lembrete poder sair de novo num teste)
delete from lembretes_pendentes where remote_jid like '556193398630%';


-- =============================================================================
-- RECEITA PARA UM TESTE "DO ZERO" COM SEU NÚMERO
--   1. Seção 4 com o seu número          (jubeauty)
--   2. Redis 8.1 com o seu número        (EasyPanel)
--   3. Seção 9 com o seu número          (conex-dash, se quiser o painel limpo também)
--   4. Mande "oi" → deve chegar a saudação de cliente novo
-- =============================================================================
