# Shared UAT access — Compass Workflow

## Result
Add a “Try the demo” picker on `/login` for shared Owner, Member and Stakeholder accounts, with no signup. UAT is **off by default**. Only a real Owner can turn it on, set an expiry, add a feedback link, provision accounts or reset the existing demo dataset.

This is the same project as real work: testers can change records and the demo Owner can change ordinary configuration. The banner will clearly identify shared access. Resetting demo data preserves real records and audit history; it does not undo arbitrary tester edits to real work or configuration.

## Security prerequisite
The app can enforce project permissions and the kill switch in server checks and database policies. However, hiding account controls does **not** prevent a tester from calling the underlying authentication service to change the shared account’s email or password.

Before enabling UAT, verify a supported authentication-level way to deny those changes for demo accounts. Do not add prohibited triggers to managed authentication tables, weaken real-account authentication, or claim an app-only guard protects the direct authentication API. If no supported enforcement exists, keep UAT disabled and report this limitation before any shared sessions are issued.

No additional secrets are expected with the preferred passwordless approach: use the existing privileged server client, generate a one-time sign-in link, and exchange it on the server without sending email. Never return the link, OTP, password or privileged key. A normal authenticated browser session necessarily receives its own session tokens; these must never be logged or included in diagnostics. Verify this approach against hosted authentication before committing to it.

## SQL review — before application
The foundational SQL below is saved separately as a **review draft, not applied**. The complete migration will also contain request-time access checks, sensitive-operation protections, private account mapping, persistent rate limiting and audit RPCs. Review that complete SQL before applying it; the foundation alone is not safe to enable.

```sql
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

INSERT INTO public.app_config(project_id, key, value)
SELECT id, 'uat_demo_access',
  '{"enabled":false,"expires_at":null,"feedback_url":null}'::jsonb
FROM public.projects
ON CONFLICT (project_id, key) DO NOTHING;
```

### Policy explanations
- **Read:** only active, non-demo project Owners can read UAT configuration; no anonymous/public access.
- **Insert:** only those Owners can create configuration, attributed to their own user ID.
- **Update:** only those Owners can change configuration, attributed to their own user ID.
- **Delete:** no client delete grant or policy; switch off instead.
- **Demo designation:** browser callers cannot set or clear the trusted `is_demo` marker.
- **Audit:** configuration changes use the existing append-only audit trigger.

## Implementation
1. Add a private project-scoped mapping for the three provisioned demo identities. Creation/re-creation is real-Owner-only, idempotent, and prevents partially provisioned accounts from becoming usable. Re-creation invalidates old demo access without affecting real accounts.
2. Extend the shared server authentication boundary without modifying generated integration files. Check demo status and live configuration on every protected request. Disabled, expired or missing configuration denies access; the browser clears protected caches, signs out and returns to `/login` with “The demo has ended.”
3. Update membership/role helpers and all self-read or owner-only policy exceptions so a retained demo token cannot bypass the switch through direct database requests or aggregate RPCs. Apply real-Owner checks to membership/invitation RPCs and project/core-profile deletion. Protect demo identity flags against client mutation.
4. Keep normal workflow, terminology, priorities, labels and custom-field configuration available to the demo Owner; block UAT controls, invitations, role changes, member deactivation and account credential changes.
5. Public availability returns **only `{ enabled }`**, uncached, false if expired or not safely provisioned. Login re-checks availability before issuance and immediately afterwards to handle concurrent disabling.
6. Rate-limit login using durable, atomic database counters keyed from a trusted platform IP header, not browser-supplied input. Default proposal: five attempts per minute per IP, across all roles. Reject safely when a trusted IP cannot be obtained. Log successful login role and timestamp without session material.
7. Add `/settings/uat` as a real-Owner-only page linked from Settings, without changing existing settings tab behavior. Controls: enabled toggle, optional date/time expiry (stored in UTC), validated HTTPS feedback link, create/re-create accounts, and confirmed reset using Step 10 removal/loading.
8. Show “UAT mode: shared [role] account, data may be reset.” across authenticated screens, with Switch role and optional Give feedback links. Render audit actors as “UAT [role] (shared)” and preserve role attribution for login events.

## Technical details
- Follow existing `src/functions/*.functions.ts`, Zod, role guards, semantic tokens and shared UI patterns.
- Extend section access rules with demo identity checks for the new page; preserve the integration-managed route gate.
- Private helper functions use narrow grants, fixed search paths and explicit authorization; never accept a client-selected project/user to bypass checks.
- New project-scoped tables include `project_id`, timestamps, explicit grants and RLS. Public functions do not expose configuration, account mapping or credentials.
- Preserve real Owner protections when the demo Owner exists: a demo Owner cannot count as the last remaining real administrator.
- Add unique app-specific page metadata, friendly loading/empty/error states and update README, architecture rules and the audit documentation.

## Verification and handover
- Tests: disabled/expired login denied; expired and disabled existing sessions denied on the next request; demo identity cannot be cleared; demo membership/invitation/UAT/project deletion blocked; member and stakeholder restrictions retained; direct authentication credential changes denied; rate-limit concurrency; login audit attribution; no password/OTP/link/privileged key in responses or shipped assets.
- Browser checks: real Owner creates accounts and enables UAT; all three role buttons enter the correct role; switch role works; feedback is shown only when configured; real Owner disables access and each open demo session loses access on its next request. Confirm real Owner and existing Google flow remain unchanged.
- Short checklist: sign in as real Owner → Settings → UAT Access → create accounts → optionally reset demo data → set expiry/feedback → enable → test each role → disable afterwards and verify active demo sessions end.
- Deliver changed-file/migration list, decisions, test results and any unverified hosted authentication behavior.