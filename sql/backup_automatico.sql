-- =============================================================================
-- CONEX DASH — Backup automático de hora em hora (todos os clientes, tudo)
-- Rodar UMA vez no SQL Editor do Supabase. Pode rodar de novo para atualizar.
-- =============================================================================
-- Como funciona:
--   - O pg_cron (agendador que roda dentro do próprio Postgres) chama
--     backup.backup_automatico() no minuto 0 de toda hora.
--   - Cada execução cria um conjunto completo no schema "backup", com o final
--     auto_AAAAMMDD_HHMM (horário de Brasília):
--       mensagens_auto_…  eventos_auto_…  clientes_auto_…
--       perfis_auto_…     logins_auto_…   funcoes_auto_…
--   - Retenção (para o banco não encher): guarda todos os backups das últimas 48 horas
--     e, além disso, o backup da meia-noite de cada dia dos últimos 30 dias.
--     Ajuste em backup.config (fim do arquivo).
--   - Cada execução fica registrada em backup.registro (deu certo? quantas linhas? erro?).
--   - O schema "backup" não é exposto pela API: a chave pública do painel não lê nada daqui.
-- =============================================================================

-- 1. Agendador e schema protegido
create extension if not exists pg_cron;
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

-- 2. Configuração da retenção
create table if not exists backup.config (
  id               int primary key default 1 check (id = 1),
  horas_completas  int not null default 48,  -- guarda TODOS os backups desse período
  dias_diarios     int not null default 30   -- depois disso, só o da meia-noite, por esse tempo
);
insert into backup.config (id) values (1) on conflict (id) do nothing;

-- 3. Registro de cada execução
create table if not exists backup.registro (
  id           bigint generated always as identity primary key,
  quando       timestamptz not null default now(),
  conjunto     text,
  mensagens    int,
  eventos      int,
  clientes     int,
  ok           boolean not null,
  apagados     int default 0,
  erro         text
);

-- 4. Cria um conjunto completo de backup com o final informado
create or replace function backup.criar_conjunto(p_final text)
returns void
language plpgsql
security definer
set search_path = public, backup
as $$
begin
  execute format('create table backup.%I as select * from public.mensagens', 'mensagens_' || p_final);
  execute format('create table backup.%I as select * from public.eventos_conversa', 'eventos_' || p_final);
  execute format('create table backup.%I as select * from public.clientes', 'clientes_' || p_final);
  execute format('create table backup.%I as select p.*, u.email from public.perfis p left join auth.users u on u.id = p.user_id', 'perfis_' || p_final);
  execute format('create table backup.%I as select id as user_id, email, created_at, last_sign_in_at from auth.users', 'logins_' || p_final);
  execute format($f$create table backup.%I as
      select p.proname::text as nome, 'função'::text as tipo, pg_get_functiondef(p.oid) as definicao
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'backup') and p.prokind = 'f'
      union all
      select viewname::text, 'view', 'create or replace view public.' || viewname || ' as ' || definition
      from pg_views where schemaname = 'public'$f$, 'funcoes_' || p_final);
end;
$$;

-- 5. Apaga backups automáticos fora da retenção. Devolve quantos conjuntos apagou.
create or replace function backup.limpar_antigos()
returns int
language plpgsql
security definer
set search_path = public, backup
as $$
declare
  cfg    backup.config;
  r      record;
  n      int := 0;
begin
  select * into cfg from backup.config where id = 1;
  for r in
    select distinct substring(table_name from 'auto_(\d{8}_\d{4})$') as marca
    from information_schema.tables
    where table_schema = 'backup' and table_name ~ '_auto_\d{8}_\d{4}$'
  loop
    declare
      quando timestamptz := to_timestamp(r.marca, 'YYYYMMDD_HH24MI')::timestamp at time zone 'America/Sao_Paulo';
      meia_noite boolean := right(r.marca, 4) = '0000';
      t record;
    begin
      if quando < now() - make_interval(hours => cfg.horas_completas)
         and (not meia_noite or quando < now() - make_interval(days => cfg.dias_diarios)) then
        for t in select table_name from information_schema.tables
                 where table_schema = 'backup' and table_name like '%\_auto\_' || r.marca escape '\'
        loop
          execute format('drop table backup.%I', t.table_name);
        end loop;
        n := n + 1;
      end if;
    end;
  end loop;
  return n;
end;
$$;

-- 6. O que o agendador chama toda hora
create or replace function backup.backup_automatico()
returns void
language plpgsql
security definer
set search_path = public, backup
as $$
declare
  v_final text := 'auto_' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD_HH24MI');
  v_apagados int := 0;
begin
  begin
    perform backup.criar_conjunto(v_final);
    v_apagados := backup.limpar_antigos();
    insert into backup.registro (conjunto, mensagens, eventos, clientes, ok, apagados)
    values (v_final,
            (select count(*) from public.mensagens),
            (select count(*) from public.eventos_conversa),
            (select count(*) from public.clientes),
            true, v_apagados);
  exception when others then
    insert into backup.registro (conjunto, ok, erro) values (v_final, false, sqlerrm);
  end;
  -- o registro em si guarda 90 dias
  delete from backup.registro where quando < now() - interval '90 days';
end;
$$;

-- Ninguém além do banco executa essas funções (a chave pública do painel não chega aqui)
revoke all on function backup.criar_conjunto(text)  from public, anon, authenticated;
revoke all on function backup.limpar_antigos()      from public, anon, authenticated;
revoke all on function backup.backup_automatico()   from public, anon, authenticated;

-- 7. Agenda: minuto 0 de toda hora (se já existir com esse nome, é atualizado)
select cron.schedule('conex-backup-horario', '0 * * * *', $$select backup.backup_automatico()$$);

-- 8. Primeiro backup agora, para conferir que está tudo funcionando
select backup.backup_automatico();
select * from backup.registro order by quando desc limit 5;

-- Pronto. Acompanhar, pausar e mudar a retenção: seção 3.5 do sql/manutencao.sql.
