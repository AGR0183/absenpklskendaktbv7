-- Fungsi bantu impor, dijalankan di proyek Supabase BARU.
-- Dipakai endpoint /api/public/hooks/migrate-in saat memindahkan data lama.

create or replace function public.import_auth_user(_u jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, phone, encrypted_password,
    email_confirmed_at, phone_confirmed_at, raw_user_meta_data,
    raw_app_meta_data, created_at, updated_at, last_sign_in_at,
    banned_until, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    (_u->>'id')::uuid,
    'authenticated',
    'authenticated',
    nullif(_u->>'email',''),
    nullif(_u->>'phone',''),
    _u->>'encrypted_password',
    (_u->>'email_confirmed_at')::timestamptz,
    (_u->>'phone_confirmed_at')::timestamptz,
    coalesce(_u->'raw_user_meta_data', '{}'::jsonb),
    coalesce(_u->'raw_app_meta_data', '{"provider":"email","providers":["email"]}'::jsonb),
    coalesce((_u->>'created_at')::timestamptz, now()),
    coalesce((_u->>'updated_at')::timestamptz, now()),
    (_u->>'last_sign_in_at')::timestamptz,
    (_u->>'banned_until')::timestamptz,
    coalesce((_u->>'is_sso_user')::boolean, false),
    coalesce((_u->>'is_anonymous')::boolean, false)
  )
  on conflict (id) do nothing;

  if nullif(_u->>'email','') is not null then
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
    values (
      gen_random_uuid(),
      (_u->>'id')::uuid,
      (_u->>'id'),
      'email',
      jsonb_build_object('sub', _u->>'id', 'email', _u->>'email', 'email_verified', true, 'phone_verified', false),
      now(), now()
    )
    on conflict (provider_id, provider) do nothing;
  end if;
end;
$$;

-- Trigger pendaftaran otomatis membuat peran 'siswa' untuk setiap akun baru.
-- Setelah data peran asli diimpor, baris 'siswa' berlebih tersebut dibuang.
create or replace function public.finalize_role_import()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_roles ur
  where ur.role = 'siswa'
    and exists (
      select 1 from public.user_roles o
      where o.user_id = ur.user_id and o.role <> 'siswa'
    );
end;
$$;

revoke all on function public.import_auth_user(jsonb) from public, anon, authenticated;
revoke all on function public.finalize_role_import() from public, anon, authenticated;
grant execute on function public.import_auth_user(jsonb) to service_role;
grant execute on function public.finalize_role_import() to service_role;
