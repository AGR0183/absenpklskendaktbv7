
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('siswa', 'guru', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_siswa text,
  kelas text,
  tempat_magang text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jenis text NOT NULL CHECK (jenis IN ('masuk', 'pulang')),
  tanggal date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Makassar')::date,
  waktu timestamptz NOT NULL DEFAULT now(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  nama_lokasi text,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tanggal, jenis)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + assign default 'siswa' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_siswa, kelas, tempat_magang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_siswa', ''),
    COALESCE(NEW.raw_user_meta_data->>'kelas', ''),
    COALESCE(NEW.raw_user_meta_data->>'tempat_magang', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Guru and admin read all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

-- RLS: attendance
CREATE POLICY "Users read own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Guru and admin read all attendance" ON public.attendance
  FOR SELECT USING (public.has_role(auth.uid(), 'guru') OR public.has_role(auth.uid(), 'admin'));

-- RLS: user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin read all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for attendance photos (public for easy WhatsApp share)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true);

CREATE POLICY "Anyone can view attendance photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'attendance-photos');
CREATE POLICY "Authenticated users upload own attendance photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attendance-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
