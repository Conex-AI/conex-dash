-- Dashboard completo de um cliente em um período, num único jsonb.
-- Roda com as permissões de quem chama (security invoker): o RLS continua valendo.
-- Datas no fuso de Brasília. Pessoas são contadas pelo telefone, uma vez no período.

create or replace function dashboard_periodo(p_cliente uuid, p_de date, p_ate date)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with ini as (
    select p_de::timestamp at time zone 'America/Sao_Paulo'        as t0,
           (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo' as t1
  ),
  msg as (
    select m.* from mensagens m, ini
    where m.cliente_id = p_cliente and m.created_at >= ini.t0 and m.created_at < ini.t1
  ),
  ev as (
    select e.* from eventos_conversa e, ini
    where e.cliente_id = p_cliente and e.created_at >= ini.t0 and e.created_at < ini.t1
  ),
  cv as (
    select c.* from v_conversoes c, ini
    where c.cliente_id = p_cliente and c.created_at >= ini.t0 and c.created_at < ini.t1
  ),
  evf as (
    select telefone,
           bool_or(evento = 'procedimento_definido')  as proc,
           bool_or(evento = 'horario_definido')       as hor,
           bool_or(evento = 'transferencia_esperada') as rep,
           bool_or(evento = 'transferencia_falha')    as falha,
           bool_or(evento = 'resolvida_sem_humano')   as resol,
           bool_or(evento = 'comprovante_recebido')   as comp
    from ev group by telefone
  ),
  pessoas as (
    select k.telefone,
           coalesce(f.proc, false)  as proc,  coalesce(f.hor, false)   as hor,
           coalesce(f.rep, false)   as rep,   coalesce(f.falha, false) as falha,
           coalesce(f.resol, false) as resol, coalesce(f.comp, false)  as comp,
           (c.telefone is not null) as agend
    from (select telefone from msg union select telefone from ev union select telefone from cv) k
    left join evf f on f.telefone = k.telefone
    left join (select distinct telefone from cv) c on c.telefone = k.telefone
  ),
  fun as (
    select count(*)                                                                   as conversas,
           count(*) filter (where proc or hor or rep or comp or agend)                as procedimento,
           count(*) filter (where hor or rep or comp or agend)                        as horario,
           count(*) filter (where rep or comp or agend)                               as repasse,
           count(*) filter (where comp or agend)                                      as comprovante,
           count(*) filter (where agend)                                              as agendamento,
           count(*) filter (where comp)                                               as comprovantes_recebidos
    from pessoas
  ),
  -- Desfecho final de cada conversa (cada pessoa cai em um só):
  -- repasse esperado (ou agendamento) > repasse por falha > resolvida pela IA > sem desfecho
  dest as (
    select count(*) filter (where rep or agend)                                       as esperado,
           count(*) filter (where not (rep or agend) and falha)                       as falha,
           count(*) filter (where not (rep or agend) and not falha and resol)         as resolvida,
           count(*) filter (where not (rep or agend or falha or resol))               as sem_desfecho
    from pessoas
  ),
  mot as (
    select coalesce(nullif(trim(motivo), ''), 'Não informado')                        as motivo,
           case when evento = 'transferencia_falha' then 'falha' else 'esperado' end  as tipo,
           count(distinct telefone)                                                   as total
    from ev
    where evento in ('transferencia_esperada', 'transferencia_falha')
    group by 1, 2
    order by total desc
    limit 12
  ),
  horas as (
    select extract(hour from created_at at time zone 'America/Sao_Paulo')::int as h, count(*) as n
    from msg where origem = 'cliente' group by 1
  ),
  procs as (
    select procedimento, count(distinct telefone) as total
    from ev where evento = 'procedimento_definido' and procedimento is not null
    group by 1 order by total desc limit 5
  ),
  -- "Pendentes agora": último comprovante dos últimos 7 dias sem agendamento confirmado depois
  pend as (
    select count(*) as n from (
      select distinct on (e.telefone) e.telefone, e.created_at
      from eventos_conversa e
      where e.cliente_id = p_cliente and e.evento = 'comprovante_recebido'
        and e.created_at > now() - interval '7 days'
      order by e.telefone, e.created_at desc
    ) u
    where not exists (
      select 1 from eventos_conversa c
      where c.cliente_id = p_cliente and c.telefone = u.telefone
        and c.evento = 'conversao' and c.created_at > u.created_at
    )
  ),
  -- Mediana, em minutos, do comprovante até a Juliana confirmar o agendamento
  tempo as (
    select percentile_cont(0.5) within group (
             order by extract(epoch from (c.created_at - x.created_at)) / 60) as mediana
    from cv c
    join lateral (
      select e.created_at from eventos_conversa e
      where e.cliente_id = c.cliente_id and e.telefone = c.telefone
        and e.evento = 'comprovante_recebido' and e.created_at <= c.created_at
      order by e.created_at desc limit 1
    ) x on true
  ),
  msgs as (
    select count(*)                                                                    as total,
           count(*) filter (where origem = 'cliente')                                  as recebidas,
           count(*) filter (where origem = 'ia' and tipo not in ('foto_enviada','video_enviado')) as ia,
           count(*) filter (where origem = 'humano')                                   as humano,
           count(*) filter (where tipo in ('foto_enviada','video_enviado'))            as midia
    from msg
  )
  select jsonb_build_object(
    'funil',         (select to_jsonb(f) from fun f),
    'desfechos',     (select to_jsonb(d) from dest d),
    'motivos',       coalesce((select jsonb_agg(to_jsonb(m) order by m.total desc) from mot m), '[]'::jsonb),
    'horas',         coalesce((select jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h) from horas), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(p) order by p.total desc) from procs p), '[]'::jsonb),
    'pix',           jsonb_build_object(
                       'comprovantes', (select comprovantes_recebidos from fun),
                       'pendentes',    (select n from pend),
                       'minutos_ate_confirmar', (select mediana from tempo)),
    'mensagens',     (select to_jsonb(m) from msgs m)
  );
$$;

revoke all on function dashboard_periodo(uuid, date, date) from public, anon;
grant execute on function dashboard_periodo(uuid, date, date) to authenticated;
