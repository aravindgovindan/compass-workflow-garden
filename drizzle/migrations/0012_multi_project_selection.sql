ALTER TABLE public.profiles ADD COLUMN active_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

UPDATE public.profiles p SET active_project_id = (
  SELECT m.project_id FROM public.project_members m WHERE m.user_id = p.id AND m.active
  ORDER BY m.created_at DESC, m.id LIMIT 1
);

CREATE OR REPLACE FUNCTION public.validate_active_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active_project_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.active_project_id IS DISTINCT FROM OLD.active_project_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = NEW.id AND project_id = NEW.active_project_id AND active)
      OR NOT public.identity_allowed(NEW.active_project_id, NEW.id) THEN
      RAISE EXCEPTION 'Project access denied';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_validate_active_project BEFORE INSERT OR UPDATE OF active_project_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_active_project();

CREATE OR REPLACE FUNCTION public.add_project_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members(project_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner') ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET active_project_id = NEW.id WHERE id = NEW.created_by;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_active_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NOT NEW.active THEN
    UPDATE public.profiles p SET active_project_id = (
      SELECT m.project_id FROM public.project_members m
      WHERE m.user_id = OLD.user_id AND m.active AND m.id <> OLD.id
        AND public.identity_allowed(m.project_id, m.user_id)
      ORDER BY m.created_at DESC, m.id LIMIT 1
    ) WHERE p.id = OLD.user_id AND p.active_project_id = OLD.project_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_members_cleanup_active AFTER UPDATE OF active OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.cleanup_active_project();

CREATE OR REPLACE FUNCTION public.accept_pending_invitation()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; inv public.pending_invitations; _accepted uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_demo_user(auth.uid()) THEN RETURN NULL; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF _email IS NULL THEN RETURN NULL; END IF;
  FOR inv IN SELECT * FROM public.pending_invitations WHERE email = _email AND status = 'pending' ORDER BY project_id, created_at, id LOOP
    PERFORM 1 FROM public.projects WHERE id = inv.project_id FOR UPDATE;
    SELECT * INTO inv FROM public.pending_invitations WHERE id = inv.id AND status = 'pending' FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 8));
    INSERT INTO public.project_members(project_id, user_id, role, active)
    VALUES(inv.project_id, auth.uid(), inv.role, true)
    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role, active = true
    WHERE NOT project_members.active;
    UPDATE public.pending_invitations SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE id = inv.id;
    _accepted := inv.project_id;
  END LOOP;
  RETURN _accepted;
END $$;

REVOKE ALL ON FUNCTION public.validate_active_project(), public.cleanup_active_project() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_active_project(), public.cleanup_active_project() TO service_role;
CREATE INDEX project_members_user_active_recent ON public.project_members(user_id, created_at DESC, id) WHERE active;
