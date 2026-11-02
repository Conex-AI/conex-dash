-- =============================================================================
-- CONEX DASH — SQL de manutenção (rodar no SQL Editor do Supabase, um bloco por vez)
-- =============================================================================
-- Instalação (uma vez, nesta ordem; os arquivos ficam na pasta sql/ do repositório):
--   1. sql/dashboard_periodo.sql   → função do Dashboard
--   2. sql/telas.sql               → Métricas, Pix, Follow-up e Clientes
--   3. sql/perfil.sql              → foto do painel
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

-- 3.1 Fazer backup agora (cria tabelas com data e hora no nome, ex.: mensagens_20261102_1445)
do $$
declare s text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MI');
begin
  execute format('create table backup.%I as select * from public.mensagens', 'mensagens_' || s);
  execute format('create table backup.%I as select * from public.eventos_conversa', 'eventos_' || s);
  raise notice 'Backup criado: backup.mensagens_% e backup.eventos_%', s, s;
end $$;

-- 3.2 Ver os backups que existem (e quantas linhas cada um tem)
select table_name,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from backup.%I', table_name), false, true, '')))[1]::text::int as linhas
from information_schema.tables
where table_schema = 'backup'
order by table_name;

-- 3.3 Restaurar um backup (troque <data> pelo sufixo, ex.: 20261102_1445).
--     Não duplica: linhas que já existem são ignoradas.
begin;
insert into public.mensagens        overriding system value select * from backup."mensagens_<data>" on conflict do nothing;
insert into public.eventos_conversa overriding system value select * from backup."eventos_<data>"   on conflict do nothing;
-- acerta o contador de ids depois de restaurar
select setval(pg_get_serial_sequence('public.mensagens', 'id'),        (select coalesce(max(id), 1) from public.mensagens));
select setval(pg_get_serial_sequence('public.eventos_conversa', 'id'), (select coalesce(max(id), 1) from public.eventos_conversa));
commit;

-- 3.4 Apagar um backup que não precisa mais
drop table if exists backup."mensagens_<data>", backup."eventos_<data>";


-- =============================================================================
-- 4. LIMPAR DADOS (não tem volta — faça o backup 3.1 antes)
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
