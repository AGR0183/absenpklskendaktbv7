CREATE TABLE public.dudi_akun (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_tempat text NOT NULL UNIQUE,
  pin text NOT NULL DEFAULT '1234',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dudi_akun TO service_role;
ALTER TABLE public.dudi_akun ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage dudi_akun" ON public.dudi_akun FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dudi_akun TO authenticated;
CREATE TRIGGER update_dudi_akun_updated_at BEFORE UPDATE ON public.dudi_akun
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();