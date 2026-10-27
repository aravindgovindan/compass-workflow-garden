ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE public.uat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  feedback_url text CHECK (feedback_url IS NULL OR feedback_url ~ '^https://'),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.uat_settings TO authenticated;
GRANT ALL ON public.uat_settings TO service_role;
ALTER TABLE public.uat_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.uat_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role public.project_role NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, role)
);
GRANT ALL ON public.uat_accounts TO service_role;
ALTER TABLE public.uat_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.uat_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uat_login_attempts_ip_idx ON public.uat_login_attempts (ip, created_at);
GRANT ALL ON public.uat_login_attempts TO service_role;
ALTER TABLE public.uat_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.uat_active(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.uat_settings s WHERE s.project_id = _project_id
    AND s.enabled AND (s.expires_at IS NULL OR s.expires_at > now()))
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_demo FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.identity_allowed(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(_user_id) OR public.uat_active(_project_id)
$$;

CREATE OR REPLACE FUNCTION public.is_real_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(_user_id) AND EXISTS (SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND active AND role = 'owner')
$$;

REVOKE ALL ON FUNCTION public.uat_active(uuid), public.is_demo_user(uuid), public.identity_allowed(uuid, uuid), public.is_real_project_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uat_active(uuid), public.is_demo_user(uuid), public.identity_allowed(uuid, uuid), public.is_real_project_owner(uuid, uuid) TO authenticated, service_role;

-- Kill switch: every membership helper rejects demo identities once UAT is off or expired.
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id and active)
    and public.identity_allowed(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _roles project_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.project_members where project_id = _project_id and user_id = _user_id and active and role = any(_roles))
    and public.identity_allowed(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.project_role_of(_project_id uuid, _user_id uuid)
RETURNS project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select role from public.project_members where project_id = _project_id and user_id = _user_id and active
    and public.identity_allowed(_project_id, _user_id)
$$;
CREATE OR REPLACE FUNCTION public.shares_project_with(_other uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.project_members a join public.project_members b on a.project_id = b.project_id
    where a.user_id = _user_id and b.user_id = _other and a.active and b.active
      and public.identity_allowed(a.project_id, _user_id))
$$;

CREATE POLICY "uat: members read" ON public.uat_settings FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "uat: real owners create" ON public.uat_settings FOR INSERT TO authenticated
WITH CHECK (public.is_real_project_owner(project_id, auth.uid()) AND updated_by = auth.uid());
CREATE POLICY "uat: real owners update" ON public.uat_settings FOR UPDATE TO authenticated
USING (public.is_real_project_owner(project_id, auth.uid()))
WITH CHECK (public.is_real_project_owner(project_id, auth.uid()) AND updated_by = auth.uid());

CREATE TRIGGER uat_settings_updated_at BEFORE UPDATE ON public.uat_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER uat_settings_activity AFTER INSERT OR UPDATE ON public.uat_settings FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER uat_accounts_updated_at BEFORE UPDATE ON public.uat_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER uat_accounts_activity AFTER INSERT OR UPDATE OR DELETE ON public.uat_accounts FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Demo identities cannot touch membership, invitations, demo resets or the core project.
CREATE OR REPLACE FUNCTION public.uat_demo_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_demo_user(auth.uid()) THEN
    IF tg_table_name = 'projects' THEN
      IF tg_op = 'DELETE' OR NEW.name IS DISTINCT FROM OLD.name OR NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'Shared UAT accounts cannot change this';
      END IF;
    ELSE
      RAISE EXCEPTION 'Shared UAT accounts cannot change this';
    END IF;
  END IF;
  IF tg_table_name = 'project_members' AND tg_op <> 'INSERT' AND OLD.active AND OLD.role = 'owner'
     AND NOT public.is_demo_user(OLD.user_id)
     AND (tg_op = 'DELETE' OR NOT NEW.active OR NEW.role <> 'owner') THEN
    _pid := OLD.project_id;
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = _pid) AND NOT EXISTS (
      SELECT 1 FROM public.project_members m JOIN public.profiles p ON p.id = m.user_id
      WHERE m.project_id = _pid AND m.active AND m.role = 'owner' AND NOT p.is_demo AND m.id <> OLD.id)
    THEN RAISE EXCEPTION 'The last owner cannot be removed or demoted'; END IF;
  END IF;
  IF tg_op = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_members_uat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.uat_demo_guard();
CREATE TRIGGER pending_invitations_uat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.pending_invitations FOR EACH ROW EXECUTE FUNCTION public.uat_demo_guard();
CREATE TRIGGER demo_batches_uat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.demo_batches FOR EACH ROW EXECUTE FUNCTION public.uat_demo_guard();
CREATE TRIGGER projects_uat_guard BEFORE UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.uat_demo_guard();

-- Browser callers can never set the demo flag, and demo accounts cannot edit their profile.
CREATE OR REPLACE FUNCTION public.protect_profile_demo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF tg_op = 'INSERT' AND NEW.is_demo THEN RAISE EXCEPTION 'Demo identity is managed by the server'; END IF;
    IF tg_op = 'UPDATE' AND (OLD.is_demo OR NEW.is_demo IS DISTINCT FROM OLD.is_demo) THEN
      RAISE EXCEPTION 'Shared UAT accounts cannot change this';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_demo BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_demo();