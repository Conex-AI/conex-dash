-- =============================================================================
-- CONEX DASH — SQL de manutenção (rodar no SQL Editor do Supabase, um bloco por vez)
-- =============================================================================
-- Instalação (uma vez, nesta ordem; os arquivos ficam na pasta sql/ do repositório):
--   1. sql/dashboard_periodo.sql   → função do Dashboard
--   2. sql/telas.sql               → Métricas, Pix, Follow-up e Clientes
--   3. sql/perfil.sql              → foto do painel
--   4. sql/backup_automatico.sql   → backup de tudo, de hora em hora (pg_cron)
-- Pode rodar de novo sempre que eu atualizar algum deles (são "create or replace").
--
-- Troque os valores entre <...> antes de rodar. O slug da Ju Beauty é 'jubeauty'.
-- =============================================================================


-- =============================================================================
-- 1. ACESSOS
-- =============================================================================

-- 1.1 Você como admin (vê todos os clientes)
insert into perfis (user_id, papel, cliente_id)
select id, 'admin', null from auth.users where email = 'erickvini96@gmail.com'
on conflict (user_id) do update set papel = 'admin', cliente_id = null;

-- 1.2 Cliente (crie o login antes em Authentication → Users → Add user)
insert into perfis (user_id, papel, cliente_id)
select u.id, 'cliente', c.id
from auth.users u, clientes c
where u.email = 'julianablenda9@gmail.com' and c.slug = 'jubeauty'
on conflict (user_id) do update set papel = 'cliente', cliente_id = excluded.cliente_id;

-- 1.3 Quem tem acesso a quê
select u.email, p.papel, c.nome as cliente, u.last_sign_in_at as ultimo_acesso
from perfis p
join auth.users u on u.id = p.user_id
left join clientes c on c.id = p.cliente_id
order by p.papel, c.nome, u.email;

-- 1.4 Tirar o acesso de alguém ao painel (o login continua existindo, mas não vê nada)
delete from perfis
where user_id = (select id from auth.users where email = '<email@exemplo.com>');


-- =============================================================================
-- 2. CLIENTES
-- =============================================================================

-- 2.1 Lista de clientes
select id, slug, nome, ativo, followup_ativo from clientes order by nome;

-- 2.2 Novo cliente (o slug é o identificador: minúsculas, sem espaço nem acento)
insert into clientes (slug, nome) values ('<slug-do-cliente>', '<Nome do Cliente>')
returning id;

-- 2.3 Ligar / desligar o follow-up de um cliente
update clientes set followup_ativo = true  where slug = 'jubeauty';
update clientes set followup_ativo = false where slug = 'jubeauty';

-- 2.4 Desativar um cliente (some da contagem de ativos; os dados continuam)
update clientes set ativo = false where slug = '<slug-do-cliente>';


-- =============================================================================
-- 3. BACKUP
-- =============================================================================
-- Os backups ficam no schema "backup", que NÃO é exposto pela API do Supabase.
-- (Uma tabela criada no schema public sem RLS pode ser lida pela chave pública
--  do painel — por isso backup nunca deve ficar em public.)

-- 3.0 Preparar o schema de backup (uma vez)
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

-- 3.0b Se você já criou backup_mensagens / backup_eventos_conversa no public,
--      mova para o schema protegido:
alter table if exists public.backup_mensagens        set schema backup;
alter table if exists public.backup_eventos_conversa set schema backup;

-- O que cada backup guarda (tabelas com o mesmo final de nome formam um "conjunto"):
--   mensagens_<nome>  → todas as mensagens          (histórico das conversas)
--   eventos_<nome>    → todos os eventos            (base de todas as métricas)
--   clientes_<nome>   → cadastro do(s) cliente(s)   (nome, slug, follow-up, link da foto)
--   perfis_<nome>     → quem acessa o quê, com o e-mail de cada login
--   logins_<nome>     → lista dos logins (e-mail, criação, último acesso) — SEM senha
--   funcoes_<nome>    → código das funções e views do painel (só no backup de todos)
-- Não dá para guardar por SQL: as senhas (o Supabase não devolve) e os arquivos de
-- imagem do Storage (baixe a foto em Storage → fotos, se quiser guardar).

-- 3.1 Backup COMPLETO de todos os clientes (final do nome: todos_20261102_1445)
do $$
declare s text := 'todos_' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MI');
begin
  execute format('create table backup.%I as select * from public.mensagens', 'mensagens_' || s);
  execute format('create table backup.%I as select * from public.eventos_conversa', 'eventos_' || s);
  execute format('create table backup.%I as select * from public.clientes', 'clientes_' || s);
  execute format('create table backup.%I as select p.*, u.email from public.perfis p left join auth.users u on u.id = p.user_id', 'perfis_' || s);
  execute format('create table backup.%I as select id as user_id, email, created_at, last_sign_in_at from auth.users', 'logins_' || s);
  execute format($f$create table backup.%I as
      select p.proname::text as nome, 'função' as tipo, pg_get_functiondef(p.oid) as definicao
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
      union all
      select viewname::text, 'view', 'create or replace view public.' || viewname || ' as ' || definition
      from pg_views where schemaname = 'public'$f$, 'funcoes_' || s);
  raise notice 'Backup completo criado com o final: %', s;
end $$;

-- 3.1b Backup COMPLETO de UM cliente (final do nome: jubeauty_20261102_1445). Troque o slug na 1ª linha.
do $$
declare
  v_slug text := 'jubeauty';
  v_id   uuid := (select id from clientes where slug = v_slug);
  s      text := v_slug || '_' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MI');
begin
  if v_id is null then raise exception 'Cliente % não encontrado', v_slug; end if;
  execute format('create table backup.%I as select * from public.mensagens where cliente_id = %L', 'mensagens_' || s, v_id);
  execute format('create table backup.%I as select * from public.eventos_conversa where cliente_id = %L', 'eventos_' || s, v_id);
  execute format('create table backup.%I as select * from public.clientes where id = %L', 'clientes_' || s, v_id);
  execute format('create table backup.%I as select p.*, u.email from public.perfis p left join auth.users u on u.id = p.user_id where p.cliente_id = %L', 'perfis_' || s, v_id);
  execute format('create table backup.%I as select u.id as user_id, u.email, u.created_at, u.last_sign_in_at from auth.users u join public.perfis p on p.user_id = u.id where p.cliente_id = %L', 'logins_' || s, v_id);
  raise notice 'Backup do cliente % criado com o final: %', v_slug, s;
end $$;

-- 3.2 Ver os backups: cada tabela, de qual cliente, quantas linhas e de quando a quando
select t.table_name                                         as tabela,
       coalesce(cl.nome, case when x.cliente_id is null then '—' else '(cliente apagado)' end) as cliente,
       x.linhas,
       x.de  at time zone 'America/Sao_Paulo'               as dados_de,
       x.ate at time zone 'America/Sao_Paulo'               as dados_ate
from information_schema.tables t
cross join lateral (
  select exists (select 1 from information_schema.columns c where c.table_schema = 'backup' and c.table_name = t.table_name and c.column_name = 'cliente_id') as tem_cliente,
         exists (select 1 from information_schema.columns c where c.table_schema = 'backup' and c.table_name = t.table_name and c.column_name = 'created_at') as tem_data
) col
cross join lateral xmltable('/table/row'
  passing query_to_xml(format(
    'select %s as cliente_id, count(*) as linhas, %s as de, %s as ate from backup.%I %s',
    case when col.tem_cliente then 'cliente_id' else 'null::uuid' end,
    case when col.tem_data then 'min(created_at)' else 'null::timestamptz' end,
    case when col.tem_data then 'max(created_at)' else 'null::timestamptz' end,
    t.table_name,
    case when col.tem_cliente then 'group by cliente_id' else '' end), false, false, '')
  columns cliente_id uuid path 'cliente_id', linhas int path 'linhas',
          de timestamptz path 'de', ate timestamptz path 'ate') x
left join clientes cl on cl.id = x.cliente_id
where t.table_schema = 'backup'
order by t.table_name, cl.nome;

-- 3.3 Restaurar um conjunto de backup (troque <nome> pelo final, ex.: jubeauty_20261102_1445).
--     Ordem: cliente → mensagens/eventos → acessos. Não duplica nada que já existe.
--     Funciona mesmo que as tabelas tenham ganhado colunas novas depois do backup.
begin;
insert into public.clientes
  select (jsonb_populate_record(null::public.clientes, to_jsonb(b))).* from backup."clientes_<nome>" b
  on conflict (id) do nothing;
insert into public.mensagens overriding system value
  select (jsonb_populate_record(null::public.mensagens, to_jsonb(b))).* from backup."mensagens_<nome>" b
  on conflict do nothing;
insert into public.eventos_conversa overriding system value
  select (jsonb_populate_record(null::public.eventos_conversa, to_jsonb(b))).* from backup."eventos_<nome>" b
  on conflict do nothing;
-- acessos: religa pelo e-mail (o login precisa existir em Authentication → Users)
insert into public.perfis (user_id, papel, cliente_id)
  select u.id, b.papel, b.cliente_id from backup."perfis_<nome>" b
  join auth.users u on lower(u.email) = lower(b.email)
  on conflict (user_id) do update set papel = excluded.papel, cliente_id = excluded.cliente_id;
select setval(pg_get_serial_sequence('public.mensagens', 'id'),        (select coalesce(max(id), 1) from public.mensagens));
select setval(pg_get_serial_sequence('public.eventos_conversa', 'id'), (select coalesce(max(id), 1) from public.eventos_conversa));
commit;

-- 3.3b Restaurar só UM cliente a partir de um backup de todos (troque o slug e o <nome>)
begin;
insert into public.clientes
  select (jsonb_populate_record(null::public.clientes, to_jsonb(b))).* from backup."clientes_<nome>" b
  where b.slug = 'jubeauty'
  on conflict (id) do nothing;
insert into public.mensagens overriding system value
  select (jsonb_populate_record(null::public.mensagens, to_jsonb(b))).* from backup."mensagens_<nome>" b
  where b.cliente_id = (select id from backup."clientes_<nome>" where slug = 'jubeauty')
  on conflict do nothing;
insert into public.eventos_conversa overriding system value
  select (jsonb_populate_record(null::public.eventos_conversa, to_jsonb(b))).* from backup."eventos_<nome>" b
  where b.cliente_id = (select id from backup."clientes_<nome>" where slug = 'jubeauty')
  on conflict do nothing;
insert into public.perfis (user_id, papel, cliente_id)
  select u.id, b.papel, b.cliente_id from backup."perfis_<nome>" b
  join auth.users u on lower(u.email) = lower(b.email)
  where b.cliente_id = (select id from backup."clientes_<nome>" where slug = 'jubeauty')
  on conflict (user_id) do update set papel = excluded.papel, cliente_id = excluded.cliente_id;
select setval(pg_get_serial_sequence('public.mensagens', 'id'),        (select coalesce(max(id), 1) from public.mensagens));
select setval(pg_get_serial_sequence('public.eventos_conversa', 'id'), (select coalesce(max(id), 1) from public.eventos_conversa));
commit;

-- 3.3c Logins que estão no backup mas não existem mais (recrie em Authentication → Users,
--      depois rode o 3.3 de novo para religar os acessos; a pessoa usa "Esqueci minha senha")
select b.email, b.papel from backup."perfis_<nome>" b
where not exists (select 1 from auth.users u where lower(u.email) = lower(b.email));

-- 3.3d Ver o código das funções/views guardado num backup completo (para recriar alguma)
select nome, tipo, definicao from backup."funcoes_<nome>" order by tipo, nome;

-- 3.4 Apagar um conjunto de backup inteiro (todas as tabelas com aquele final)
do $$
declare v_nome text := '<nome>';  -- ex.: jubeauty_20261102_1445
        r record;
begin
  for r in select table_name from information_schema.tables
           where table_schema = 'backup' and table_name like '%\_' || v_nome escape '\'
  loop
    execute format('drop table backup.%I', r.table_name);
    raise notice 'Apagada: backup.%', r.table_name;
  end loop;
end $$;

-- 3.5 BACKUP AUTOMÁTICO (instalado pelo sql/backup_automatico.sql) — rode só a consulta que precisar

-- Últimas execuções (ok = true é sucesso; se false, a coluna erro diz o motivo)
select quando at time zone 'America/Sao_Paulo' as quando, conjunto, mensagens, eventos, clientes, ok, apagados, erro
from backup.registro order by quando desc limit 24;

-- Execuções do agendador vistas pelo próprio pg_cron
select start_time at time zone 'America/Sao_Paulo' as inicio, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'conex-backup-horario')
order by start_time desc limit 10;

-- Quanto espaço os backups estão ocupando
select count(*) as tabelas, pg_size_pretty(sum(pg_total_relation_size(format('backup.%I', table_name)::regclass))) as tamanho
from information_schema.tables where table_schema = 'backup';

-- Mudar a retenção (ex.: 72 horas completas e 60 dias de diários)
update backup.config set horas_completas = 72, dias_diarios = 60 where id = 1;

-- Pausar / retomar o backup automático
select cron.unschedule('conex-backup-horario');
select cron.schedule('conex-backup-horario', '0 * * * *', $$select backup.backup_automatico()$$);

-- Para restaurar um backup automático, use 3.2 e 3.3 com o final do conjunto, ex.: auto_20261103_0100

-- =============================================================================
-- 4. LIMPAR DADOS (não tem volta — faça o backup 3.1 ou 3.1b antes)
-- =============================================================================

-- 4.1 Zerar o painel de UM cliente (mantém cliente, logins e foto)
begin;
delete from eventos_conversa where cliente_id = (select id from clientes where slug = 'jubeauty');
delete from mensagens        where cliente_id = (select id from clientes where slug = 'jubeauty');
commit;

-- 4.2 Apagar só alguns números (ex.: os seus números de teste)
begin;
delete from eventos_conversa where telefone in ('<5561999999999>', '<5561988888888>');
delete from mensagens        where telefone in ('<5561999999999>', '<5561988888888>');
commit;

-- 4.3 Apagar tudo de antes de uma data (ex.: dados de teste antes de ir ao ar)
begin;
delete from eventos_conversa where cliente_id = (select id from clientes where slug = 'jubeauty') and created_at < '<2026-11-03>';
delete from mensagens        where cliente_id = (select id from clientes where slug = 'jubeauty') and created_at < '<2026-11-03>';
commit;

-- 4.4 Conferência depois de limpar
select c.slug,
       (select count(*) from mensagens m        where m.cliente_id = c.id) as mensagens,
       (select count(*) from eventos_conversa e where e.cliente_id = c.id) as eventos
from clientes c order by c.slug;
-- Depois de limpar, recarregue o painel com Ctrl+F5 (ele guarda os dados por 1 minuto).


-- =============================================================================
-- 5. CONFERIR DADOS / DIAGNÓSTICO
-- =============================================================================

-- 5.1 Resumo por cliente: quantidade e período dos dados
select c.slug,
       count(distinct m.telefone)                                    as contatos,
       count(m.*)                                                    as mensagens,
       min(m.created_at) at time zone 'America/Sao_Paulo'            as primeira,
       max(m.created_at) at time zone 'America/Sao_Paulo'            as ultima
from clientes c left join mensagens m on m.cliente_id = c.id
group by c.slug order by c.slug;

-- 5.2 Últimas 50 mensagens (mais recentes primeiro)
select m.created_at at time zone 'America/Sao_Paulo' as quando, c.slug, m.telefone, m.nome_wpp,
       m.origem, m.tipo, left(m.conteudo, 120) as conteudo
from mensagens m join clientes c on c.id = m.cliente_id
order by m.created_at desc
limit 50;

-- 5.3 Últimos 50 eventos (mais recentes primeiro)
select e.created_at at time zone 'America/Sao_Paulo' as quando, c.slug, e.telefone,
       e.evento, e.motivo, e.procedimento, e.valor, e.estagio
from eventos_conversa e join clientes c on c.id = e.cliente_id
order by e.created_at desc
limit 50;

-- 5.4 Quantos eventos de cada tipo nos últimos 30 dias (ver se o fluxo está gravando tudo)
select c.slug, e.evento, count(*) as total,
       max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo
from eventos_conversa e join clientes c on c.id = e.cliente_id
where e.created_at > now() - interval '30 days'
group by c.slug, e.evento
order by c.slug, total desc;

-- 5.5 Linha do tempo completa de UMA conversa (mensagens + eventos, na ordem)
select quando, tipo, quem, detalhe from (
  select created_at at time zone 'America/Sao_Paulo' as quando, 'mensagem' as tipo, origem as quem, conteudo as detalhe
  from mensagens where telefone = '<5561999999999>'
  union all
  select created_at at time zone 'America/Sao_Paulo', 'evento', evento,
         concat_ws(' · ', motivo, procedimento, valor::text)
  from eventos_conversa where telefone = '<5561999999999>'
) t
order by quando;

-- 5.6 Testar as funções do painel (últimos 30 dias da Ju Beauty)
select dashboard_periodo((select id from clientes where slug = 'jubeauty'), current_date - 29, current_date) -> 'funil';
select metricas_periodo ((select id from clientes where slug = 'jubeauty'), current_date - 29, current_date);
select pix_periodo      ((select id from clientes where slug = 'jubeauty'), current_date - 29, current_date);

-- 5.7 Conferir se as funções do painel estão instaladas (devem aparecer 9)
select proname from pg_proc
where proname in ('dashboard_periodo', 'funil_periodo', 'metricas_periodo', 'pix_periodo', 'followup_periodo',
                  'clientes_resumo', 'admin_acessos', 'admin_vincular_acesso', 'definir_foto_cliente')
order by proname;

-- 5.8 Atualizar o cache da API depois de criar/alterar funções (resolve "function not found")
notify pgrst, 'reload schema';
