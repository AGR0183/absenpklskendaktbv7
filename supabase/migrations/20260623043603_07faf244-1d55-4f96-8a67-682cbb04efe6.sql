-- Restrict writes on wa_schedule_settings to admins only
CREATE POLICY "Admins insert wa settings" ON public.wa_schedule_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update wa settings" ON public.wa_schedule_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete wa settings" ON public.wa_schedule_settings
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));