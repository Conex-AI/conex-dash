-- Funções das telas Métricas, Pix, Follow-up e Clientes.
-- Rodar uma vez no SQL Editor do Supabase (pode rodar de novo: tudo é "create or replace").
-- As de leitura são security invoker: o RLS continua decidindo o que cada usuário vê.
-- Datas no fuso de Brasília.

-- ---------------------------------------------------------------------------
-- MÉTRICAS: como a Jú atende
-- ---------------------------------------------------------------------------
create or replace function metricas_periodo(p_cliente uuid, p_de date, p_ate date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with ini as (
    select p_de::timestamp at time zone 'America/Sao_Paulo'        as t0,
           (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo' as t1
  ),
  msg as (
    select m.telefone, m.origem, m.created_at,
           lag(m.origem) over (partition by m.telefone order by m.created_at) as origem_ant
    from mensagens m, ini
    where m.cliente_id = p_cliente and m.created_at >= ini.t0 and m.created_at < ini.t1
  ),
  ev as (
    select e.* from eventos_conversa e, ini
    where e.cliente_id = p_cliente and e.created_at >= ini.t0 and e.created_at < ini.t1
  ),
  cv as (
    select c.telefone, c.created_at from v_conversoes c, ini
    where c.cliente_id = p_cliente and c.created_at >= ini.t0 and c.created_at < ini.t1
  ),
  -- 1ª resposta: cada vez que a cliente começa a falar (a mensagem anterior não era dela),
  -- quanto tempo até a próxima mensagem da Jú.
  turnos as (
    select t.telefone, t.created_at,
           (select min(r.created_at) from msg r
             where r.telefone = t.telefone and r.origem = 'ia' and r.created_at > t.created_at) as resp
    from msg t
    where t.origem = 'cliente' and coalesce(t.origem_ant, '') <> 'cliente'
  ),
  por_conversa as (select telefone, count(*) as n from msg group by telefone),
  inicio as (select telefone, min(created_at) as t from msg group by telefone),
  repasse as (
    select telefone, min(created_at) as t from ev
    where evento = 'transferencia_esperada' group by telefone
  ),
  -- Taxa de sucesso por semana (semana começando na segunda)
  pessoas_semana as (
    select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana, telefone,
           false as sucesso
    from msg
    union all
    select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date, telefone,
           evento in ('transferencia_esperada', 'resolvida_sem_humano', 'conversao')
    from ev
  ),
  semanas as (
    select semana,
           count(distinct telefone)                          as conversas,
           count(distinct telefone) filter (where sucesso)   as sucessos
    from pessoas_semana group by semana
  ),
  proc as (
    select distinct on (telefone) telefone, procedimento
    from ev where evento = 'procedimento_definido' and procedimento is not null
    order by telefone, created_at desc
  ),
  procs as (
    select p.procedimento,
           count(*)                                                        as conversas,
           count(*) filter (where exists (select 1 from cv where cv.telefone = p.telefone)) as agendadas
    from proc p group by p.procedimento
    order by conversas desc limit 10
  ),
  -- Quando as clientes chamam: dia da semana (1 = segunda) x faixa de 6 horas
  mapa as (
    select extract(isodow from created_at at time zone 'America/Sao_Paulo')::int        as dia,
           (extract(hour from created_at at time zone 'America/Sao_Paulo')::int / 6)    as faixa,
           count(*) as n
    from msg where origem = 'cliente' group by 1, 2
  )
  select jsonb_build_object(
    'primeira_resposta_seg', (select percentile_cont(0.5) within group (order by extract(epoch from resp - created_at))
                              from turnos where resp is not null),
    'msgs_por_conversa',     (select round(avg(n), 1) from por_conversa),
    'msgs_por_conversa_mediana', (select percentile_cont(0.5) within group (order by n) from por_conversa),
    'minutos_ate_repasse',   (select percentile_cont(0.5) within group (order by extract(epoch from r.t - i.t) / 60)
                              from repasse r join inicio i using (telefone) where r.t >= i.t),
    'semanas',      coalesce((select jsonb_agg(to_jsonb(s) order by s.semana) from semanas s), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(p) order by p.conversas desc) from procs p), '[]'::jsonb),
    'sem_procedimento', (select count(*) from por_conversa pc where not exists (select 1 from proc p where p.telefone = pc.telefone)),
    'mapa',         coalesce((select jsonb_agg(to_jsonb(m)) from mapa m), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- PIX: do pedido do sinal ao agendamento confirmado
-- "Sinal solicitado" = a Jú mandou mensagem falando de Pix para a pessoa
-- (o fluxo ainda não grava um evento próprio para isso).
-- ---------------------------------------------------------------------------
create or replace function pix_periodo(p_cliente uuid, p_de date, p_ate date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with ini as (
    select p_de::timestamp at time zone 'America/Sao_Paulo'        as t0,
           (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo' as t1
  ),
  pedido as (
    select m.telefone, min(m.created_at) as t
    from mensagens m, ini
    where m.cliente_id = p_cliente and m.origem = 'ia' and m.conteudo ilike '%pix%'
      and m.created_at >= ini.t0 and m.created_at < ini.t1
    group by m.telefone
  ),
  comp as (
    select e.telefone, min(e.created_at) as t, max(e.created_at) as ultimo,
           (array_agg(e.valor order by e.created_at desc))[1] as valor
    from eventos_conversa e, ini
    where e.cliente_id = p_cliente and e.evento = 'comprovante_recebido'
      and e.created_at >= ini.t0 and e.created_at < ini.t1
    group by e.telefone
  ),
  conf as (
    select c.telefone, min(cv.created_at) as t
    from comp c
    join v_conversoes cv on cv.cliente_id = p_cliente and cv.telefone = c.telefone and cv.created_at >= c.t
    group by c.telefone
  ),
  nomes as (
    select distinct on (telefone) telefone, nome_wpp
    from mensagens where cliente_id = p_cliente and nome_wpp is not null and origem = 'cliente'
    order by telefone, created_at desc
  ),
  proc as (
    select distinct on (telefone) telefone, procedimento
    from eventos_conversa
    where cliente_id = p_cliente and evento = 'procedimento_definido' and procedimento is not null
    order by telefone, created_at desc
  ),
  recentes as (
    select c.telefone, n.nome_wpp, p.procedimento, c.valor, c.ultimo as recebido_em, f.t as confirmado_em
    from comp c
    left join conf  f using (telefone)
    left join nomes n using (telefone)
    left join proc  p using (telefone)
    order by c.ultimo desc limit 20
  )
  select jsonb_build_object(
    'solicitados',  (select count(*) from pedido),
    'comprovantes', (select count(*) from comp),
    'confirmados',  (select count(*) from conf),
    'valor_confirmado', (select sum(nullif(case when c.valor::text like '%,%'
                                             then replace(replace(regexp_replace(c.valor::text, '[^0-9,.]', '', 'g'), '.', ''), ',', '.')
                                             else regexp_replace(c.valor::text, '[^0-9.]', '', 'g') end, '')::numeric)
                         from comp c join conf using (telefone)),
    'minutos_ate_comprovante', (select percentile_cont(0.5) within group (order by extract(epoch from c.t - p.t) / 60)
                                from comp c join pedido p using (telefone) where c.t >= p.t),
    'minutos_ate_confirmar',   (select percentile_cont(0.5) within group (order by extract(epoch from f.t - c.ultimo) / 60)
                                from conf f join comp c using (telefone) where f.t >= c.ultimo),
    'parados_2h',   (select count(*) from comp c
                     where c.ultimo < now() - interval '2 hours'
                       and not exists (select 1 from conf f where f.telefone = c.telefone)),
    'recentes',     coalesce((select jsonb_agg(to_jsonb(r) order by r.recebido_em desc) from recentes r), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- FOLLOW-UP: envios por estágio, respostas e conversões em até 48h
-- (depende do evento followup_enviado, que o fluxo grava quando o follow-up está ligado)
-- ---------------------------------------------------------------------------
create or replace function followup_periodo(p_cliente uuid, p_de date, p_ate date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with ini as (
    select p_de::timestamp at time zone 'America/Sao_Paulo'        as t0,
           (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo' as t1
  ),
  env as (
    select e.telefone, coalesce(e.estagio, 1)::int as estagio, e.created_at,
           lead(e.created_at) over (partition by e.telefone order by e.created_at) as proximo
    from eventos_conversa e, ini
    where e.cliente_id = p_cliente and e.evento = 'followup_enviado'
      and e.created_at >= ini.t0 and e.created_at < ini.t1
  ),
  res as (
    select v.estagio, v.telefone,
           exists (select 1 from mensagens m
                   where m.cliente_id = p_cliente and m.telefone = v.telefone and m.origem = 'cliente'
                     and m.created_at > v.created_at
                     and m.created_at < coalesce(v.proximo, v.created_at + interval '48 hours')) as respondeu,
           exists (select 1 from v_conversoes c
                   where c.cliente_id = p_cliente and c.telefone = v.telefone
                     and c.created_at > v.created_at
                     and c.created_at <= v.created_at + interval '48 hours'
                     and (v.proximo is null or c.created_at < v.proximo)) as converteu
    from env v
  ),
  estagios as (
    select estagio, count(*) as enviados,
           count(*) filter (where respondeu) as respostas,
           count(*) filter (where converteu) as conversoes
    from res group by estagio
  ),
  -- Onde a pessoa estava quando recebeu o 1º follow-up
  etapa as (
    select v.telefone,
           case
             when exists (select 1 from eventos_conversa e where e.cliente_id = p_cliente and e.telefone = v.telefone
                          and e.evento = 'horario_definido' and e.created_at < v.created_at) then 'Antes de enviar o comprovante'
             when exists (select 1 from eventos_conversa e where e.cliente_id = p_cliente and e.telefone = v.telefone
                          and e.evento = 'procedimento_definido' and e.created_at < v.created_at) then 'Antes de definir o horário'
             else 'Antes de definir o procedimento'
           end as onde
    from (select distinct on (telefone) telefone, created_at from env order by telefone, created_at) v
  )
  select jsonb_build_object(
    'pessoas',    (select count(distinct telefone) from env),
    'estagios',   coalesce((select jsonb_agg(to_jsonb(s) order by s.estagio) from estagios s), '[]'::jsonb),
    'onde_parou', coalesce((select jsonb_agg(jsonb_build_object('onde', onde, 'total', n) order by n desc)
                            from (select onde, count(*) as n from etapa group by onde) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- CLIENTES (admin): resumo de cada cliente no período.
-- security invoker: um cliente comum que chamar só recebe a própria linha.
-- ---------------------------------------------------------------------------
create or replace function clientes_resumo(p_de date, p_ate date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with ini as (
    select p_de::timestamp at time zone 'America/Sao_Paulo'        as t0,
           (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo' as t1
  ),
  pessoas as (
    select cliente_id, telefone from mensagens, ini where created_at >= ini.t0 and created_at < ini.t1
    union
    select cliente_id, telefone from eventos_conversa, ini where created_at >= ini.t0 and created_at < ini.t1
  ),
  suc as (
    select distinct cliente_id, telefone from eventos_conversa, ini
    where created_at >= ini.t0 and created_at < ini.t1
      and evento in ('transferencia_esperada', 'resolvida_sem_humano', 'conversao')
  ),
  conv as (
    select distinct cliente_id, telefone from v_conversoes, ini where created_at >= ini.t0 and created_at < ini.t1
  ),
  ult as (select cliente_id, max(created_at) as ultima_msg_em from mensagens group by cliente_id)
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente_id', c.id,
           'conversas',  (select count(*) from pessoas p where p.cliente_id = c.id),
           'sucessos',   (select count(*) from suc s where s.cliente_id = c.id),
           'conversoes', (select count(*) from conv v where v.cliente_id = c.id),
           'ultima_msg_em', (select ultima_msg_em from ult u where u.cliente_id = c.id)
         )), '[]'::jsonb)
  from clientes c;
$$;

-- Acessos (logins) de um cliente, com e-mail e último acesso.
-- Precisa ler auth.users, por isso é security definer, mas só responde para admin.
create or replace function admin_acessos(p_cliente uuid)
returns table (user_id uuid, email text, papel text, ultimo_acesso timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Somente admin';
  end if;
  return query
    select p.user_id, u.email::text, p.papel::text, u.last_sign_in_at
    from perfis p join auth.users u on u.id = p.user_id
    where p.cliente_id = p_cliente or p.papel = 'admin'
    order by (p.papel = 'admin'), u.email;
end;
$$;

-- Vincula um login JÁ CRIADO (Supabase > Authentication > Add user) a um cliente.
create or replace function admin_vincular_acesso(p_email text, p_cliente uuid, p_papel text default 'cliente')
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_user uuid;
begin
  if not is_admin() then
    raise exception 'Somente admin';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Usuário não encontrado. Crie o login primeiro em Authentication > Users.';
  end if;
  insert into perfis (user_id, papel, cliente_id)
  values (v_user, p_papel, case when p_papel = 'admin' then null else p_cliente end)
  on conflict (user_id) do update set papel = excluded.papel, cliente_id = excluded.cliente_id;
end;
$$;

-- Admin pode cadastrar clientes novos pelo painel.
drop policy if exists clientes_admin_insert on clientes;
create policy clientes_admin_insert on clientes for insert to authenticated with check (is_admin());

revoke all on function metricas_periodo(uuid, date, date)           from public, anon;
revoke all on function pix_periodo(uuid, date, date)                from public, anon;
revoke all on function followup_periodo(uuid, date, date)           from public, anon;
revoke all on function clientes_resumo(date, date)                  from public, anon;
revoke all on function admin_acessos(uuid)                          from public, anon;
revoke all on function admin_vincular_acesso(text, uuid, text)      from public, anon;
grant execute on function metricas_periodo(uuid, date, date)        to authenticated;
grant execute on function pix_periodo(uuid, date, date)             to authenticated;
grant execute on function followup_periodo(uuid, date, date)        to authenticated;
grant execute on function clientes_resumo(date, date)               to authenticated;
grant execute on function admin_acessos(uuid)                       to authenticated;
grant execute on function admin_vincular_acesso(text, uuid, text)   to authenticated;

notify pgrst, 'reload schema';
