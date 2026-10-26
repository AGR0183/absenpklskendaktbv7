-- ============================================================
-- Pemindahan data: proyek Supabase LAMA  ->  proyek Supabase BARU
-- Jalankan di SQL Editor proyek LAMA, satu LANGKAH per sekali jalan.
-- Ganti dulu __URL__ dan __TOKEN__ di bawah.
-- ============================================================
-- __URL__   = https://<domain-aplikasi>/api/public/hooks/migrate-in
-- __TOKEN__ = token migrasi sementara

create extension if not exists pg_net with schema extensions;

-- ---------- LANGKAH 1: akun login (auth.users) ----------
do $$
declare
  v_url text := '__URL__';
  v_token text := '__TOKEN__';
  off int := 0; batch jsonb; n int;
begin
  loop
    select coalesce(jsonb_agg(u), '[]'::jsonb) into batch from (
      select id, email, phone, encrypted_password, email_confirmed_at,
             phone_confirmed_at, raw_user_meta_data, raw_app_meta_data,
             created_at, updated_at, last_sign_in_at, banned_until,
             is_sso_user, is_anonymous
      from auth.users order by created_at, id offset off limit 50
    ) u;
    n := jsonb_array_length(batch);
    exit when n = 0;
    perform net.http_post(
      v_url,
      jsonb_build_object('token', v_token, 'table', 'auth_users', 'rows', batch),
      headers => '{"Content-Type":"application/json"}'::jsonb
    );
    off := off + n;
  end loop;
end $$;

-- ---------- LANGKAH 2: profil, siswa, peran ----------
do $$
declare
  v_url text := '__URL__';
  v_token text := '__TOKEN__';
  v_tables text[] := array['profiles','siswa','user_roles'];
  t text; off int; batch jsonb; n int;
begin
  foreach t in array v_tables loop
    off := 0;
    loop
      execute format(
        'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select * from public.%I order by 1 offset %s limit 200) x',
        t, off) into batch;
      n := jsonb_array_length(batch);
      exit when n = 0;
      perform net.http_post(
        v_url,
        jsonb_build_object('token', v_token, 'table', t, 'rows', batch),
        headers => '{"Content-Type":"application/json"}'::jsonb
      );
      off := off + n;
    end loop;
  end loop;
end $$;

-- ---------- LANGKAH 3: data pendukung ----------
do $$
declare
  v_url text := '__URL__';
  v_token text := '__TOKEN__';
  v_tables text[] := array['dudi_akun','ortu_link','guru_favorit_siswa','push_tokens',
                           'wa_schedule_settings','wa_schedule_overrides','pin_lockout'];
  t text; off int; batch jsonb; n int;
begin
  foreach t in array v_tables loop
    off := 0;
    loop
      execute format(
        'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select * from public.%I order by 1 offset %s limit 200) x',
        t, off) into batch;
      n := jsonb_array_length(batch);
      exit when n = 0;
      perform net.http_post(
        v_url,
        jsonb_build_object('token', v_token, 'table', t, 'rows', batch),
        headers => '{"Content-Type":"application/json"}'::jsonb
      );
      off := off + n;
    end loop;
  end loop;
end $$;

-- ---------- LANGKAH 4: riwayat absensi + log pengingat ----------
do $$
declare
  v_url text := '__URL__';
  v_token text := '__TOKEN__';
  v_tables text[] := array['attendance','wa_reminder_log'];
  t text; off int; batch jsonb; n int;
begin
  foreach t in array v_tables loop
    off := 0;
    loop
      execute format(
        'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select * from public.%I order by 1 offset %s limit 200) x',
        t, off) into batch;
      n := jsonb_array_length(batch);
      exit when n = 0;
      perform net.http_post(
        v_url,
        jsonb_build_object('token', v_token, 'table', t, 'rows', batch),
        headers => '{"Content-Type":"application/json"}'::jsonb
      );
      off := off + n;
    end loop;
  end loop;
end $$;

-- ---------- LANGKAH 5: rapikan peran ----------
select net.http_post(
  '__URL__',
  jsonb_build_object('token', '__TOKEN__', 'table', 'finalize_roles', 'rows', jsonb_build_array(1)),
  headers => '{"Content-Type":"application/json"}'::jsonb
);
