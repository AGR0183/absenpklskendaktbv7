CREATE TABLE public.guru_favorit_siswa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_id uuid NOT NULL,
  siswa_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guru_id, siswa_id)
);

GRANT SELECT, INSERT, DELETE ON public.guru_favorit_siswa TO authenticated;
GRANT ALL ON public.guru_favorit_siswa TO service_role;

ALTER TABLE public.guru_favorit_siswa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guru read own favorites"
  ON public.guru_favorit_siswa FOR SELECT
  TO authenticated
  USING (auth.uid() = guru_id);

CREATE POLICY "Guru insert own favorites"
  ON public.guru_favorit_siswa FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = guru_id
    AND (has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Guru delete own favorites"
  ON public.guru_favorit_siswa FOR DELETE
  TO authenticated
  USING (auth.uid() = guru_id);

CREATE INDEX guru_favorit_siswa_guru_idx ON public.guru_favorit_siswa(guru_id);