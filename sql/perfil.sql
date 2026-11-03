-- Perfil: foto do painel de cada cliente.
-- Rodar uma vez no SQL Editor do Supabase.
--
-- Por quê:
--  1. clientes.foto_url guarda o endereço da foto que aparece no menu do painel.
--  2. O bucket "fotos" (Storage) guarda as imagens. Leitura pública (é só a foto do painel),
--     envio só por quem está logado e só na pasta do próprio cliente (admin pode em todas).
--  3. definir_foto_cliente grava a foto sem abrir a tabela clientes para escrita:
--     o cliente só consegue alterar a foto do próprio cliente.

alter table clientes add column if not exists foto_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists fotos_leitura on storage.objects;
drop policy if exists fotos_envio   on storage.objects;
drop policy if exists fotos_troca   on storage.objects;
drop policy if exists fotos_remocao on storage.objects;

-- leitura dos arquivos pelo login (o envio do Storage confere o arquivo depois de gravar)
create policy fotos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
create policy fotos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (public.is_admin() or (storage.foldername(name))[1] = public.meu_cliente_id()::text));
create policy fotos_troca on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (public.is_admin() or (storage.foldername(name))[1] = public.meu_cliente_id()::text));
create policy fotos_remocao on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (public.is_admin() or (storage.foldername(name))[1] = public.meu_cliente_id()::text));

create or replace function definir_foto_cliente(p_cliente uuid, p_url text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not (is_admin() or p_cliente = meu_cliente_id()) then
    raise exception 'Sem permissão para alterar este cliente';
  end if;
  update clientes set foto_url = nullif(p_url, '') where id = p_cliente;
end;
$$;

revoke all on function definir_foto_cliente(uuid, text) from public, anon;
grant execute on function definir_foto_cliente(uuid, text) to authenticated;

notify pgrst, 'reload schema';
