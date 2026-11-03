-- Perfil de cada LOGIN (nome e foto da própria pessoa).
-- Rodar uma vez no SQL Editor do Supabase (conex-dash). Pode rodar de novo.
--
-- Por quê: o perfil do menu precisa ser de quem está logado.
--  - Admin (você): perfil próprio, com o seu nome e a sua foto.
--  - Cliente (Juliana): continua vendo e alterando a foto do painel da Ju Beauty.
-- A pessoa só consegue alterar o próprio perfil (a função usa o login de quem chama).

alter table perfis add column if not exists nome text;
alter table perfis add column if not exists foto_url text;

create or replace function atualizar_meu_perfil(p_nome text default null, p_foto_url text default null, p_limpar_foto boolean default false)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login de novo';
  end if;
  update perfis
     set nome     = coalesce(nullif(trim(p_nome), ''), nome),
         foto_url = case when p_limpar_foto then null else coalesce(nullif(p_foto_url, ''), foto_url) end
   where user_id = auth.uid();
end;
$$;

revoke all on function atualizar_meu_perfil(text, text, boolean) from public, anon;
grant execute on function atualizar_meu_perfil(text, text, boolean) to authenticated;

-- Seu nome de exibição (pode trocar depois pela tela Meu perfil)
update perfis set nome = 'Erick Vinícius'
where user_id = (select id from auth.users where email = 'erickvini96@gmail.com') and nome is null;

notify pgrst, 'reload schema';
