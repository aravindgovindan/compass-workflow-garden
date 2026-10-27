# Compass Workflow — UAT access

Status: implemented (self-healing shared accounts), off by default.

- Real owner: Settings → Test access → Set up shared accounts, then switch on, optional expiry and https feedback link.
- Testers: Sign-in page → "Try it as a tester" → Owner / Member / Stakeholder. Banner allows switching roles, feedback and exit.
- Each login resets the shared account's email and password on the server, so a tester changing them cannot lock others out.
- Switching off or expiry: all database access for shared accounts stops immediately; open pages sign out on next navigation or within a minute.
- Shared accounts cannot manage team/invitations, demo data, project name/code, their profile, create projects, or see Test access/Demo data tabs.
- Limits: 5 login attempts per minute per IP. Shared accounts work on the real project data.
