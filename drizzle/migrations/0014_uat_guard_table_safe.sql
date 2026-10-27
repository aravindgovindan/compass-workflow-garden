CREATE OR REPLACE FUNCTION public.uat_demo_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _removing boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_demo_user(auth.uid()) THEN
    IF TG_TABLE_NAME = 'projects' THEN
      IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Shared UAT accounts cannot change this'; END IF;
      IF NEW.name IS DISTINCT FROM OLD.name OR NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'Shared UAT accounts cannot change this';
      END IF;
    ELSE RAISE EXCEPTION 'Shared UAT accounts cannot change this'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'project_members' THEN
    IF TG_OP <> 'INSERT' THEN
      IF OLD.active AND OLD.role = 'owner' AND NOT public.is_demo_user(OLD.user_id) THEN
        IF TG_OP = 'DELETE' THEN _removing := true;
        ELSE _removing := NOT NEW.active OR NEW.role <> 'owner'; END IF;
        IF _removing THEN
          _pid := OLD.project_id;
          IF EXISTS (SELECT 1 FROM public.projects WHERE id = _pid) AND NOT EXISTS (
            SELECT 1 FROM public.project_members m JOIN public.profiles p ON p.id = m.user_id
            WHERE m.project_id = _pid AND m.active AND m.role = 'owner' AND NOT p.is_demo AND m.id <> OLD.id)
          THEN RAISE EXCEPTION 'The last owner cannot be removed or demoted'; END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
