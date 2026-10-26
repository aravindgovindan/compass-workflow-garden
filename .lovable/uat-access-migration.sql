-- REVIEW DRAFT ONLY. Not applied.
-- This foundational SQL is not the complete security migration.
-- Login must remain disabled until session issuance, all access helpers,
-- sensitive-operation guards and direct Auth account-update protection pass.

ALTER TABLE public.profiles
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT
    '{"enabled":false,"expires_at":null,"feedback_url":null}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);
GRANT SELECT, INSERT, UPDATE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Narrow SECURITY DEFINER check avoids recursive profile/membership RLS.
CREATE OR REPLACE FUNCTION public.is_real_project_owner(_pid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.project_id = _pid AND m.user_id = _uid
      AND m.active AND m.role = 'owner' AND NOT p.is_demo
  )
$$;
REVOKE ALL ON FUNCTION public.is_real_project_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_real_project_owner(uuid, uuid)
  TO authenticated, service_role;

CREATE POLICY "Real owners read UAT configuration"
ON public.app_config FOR SELECT TO authenticated
USING (public.is_real_project_owner(project_id, auth.uid()));
CREATE POLICY "Real owners create UAT configuration"
ON public.app_config FOR INSERT TO authenticated
WITH CHECK (public.is_real_project_owner(project_id, auth.uid())
  AND updated_by = auth.uid());
CREATE POLICY "Real owners update UAT configuration"
ON public.app_config FOR UPDATE TO authenticated
USING (public.is_real_project_owner(project_id, auth.uid()))
WITH CHECK (public.is_real_project_owner(project_id, auth.uid())
  AND updated_by = auth.uid());

CREATE TRIGGER app_config_updated_at BEFORE UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_config_activity AFTER INSERT OR UPDATE ON public.app_config
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Prevent any browser caller from changing the trusted demo designation.
CREATE OR REPLACE FUNCTION public.protect_profile_demo_designation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_demo THEN
        RAISE EXCEPTION 'Demo identity is managed by the server';
      END IF;
    ELSIF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
      RAISE EXCEPTION 'Demo identity is managed by the server';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER profiles_protect_demo BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_demo_designation();

-- Default off for all existing projects. Future projects need equivalent
-- insertion added to the existing project configuration seeding function.
INSERT INTO public.app_config(project_id, key, value)
SELECT id, 'uat_demo_access',
  '{"enabled":false,"expires_at":null,"feedback_url":null}'::jsonb
FROM public.projects
ON CONFLICT (project_id, key) DO NOTHING;