CREATE OR REPLACE FUNCTION public.uat_block_demo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_demo_user(auth.uid()) THEN
    RAISE EXCEPTION 'Shared UAT accounts cannot change this';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER projects_uat_block_insert BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.uat_block_demo_insert();