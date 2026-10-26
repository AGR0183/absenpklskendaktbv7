GRANT SELECT, INSERT ON public.wa_reminder_log TO authenticated;
GRANT ALL ON public.wa_reminder_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_schedule_settings TO authenticated;
GRANT ALL ON public.wa_schedule_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_schedule_overrides TO authenticated;
GRANT ALL ON public.wa_schedule_overrides TO service_role;