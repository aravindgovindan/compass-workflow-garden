import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — PlanAProject" },
      { name: "description", content: "Sign in or create your PlanAProject account." },
      { property: "og:title", content: "Sign in — PlanAProject" },
      { property: "og:description", content: "Sign in or create your PlanAProject account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = signInSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function onSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: parsed.data.fullName } },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) navigate({ to: "/dashboard", replace: true });
    else setSentTo(parsed.data.email);
  }

  async function onForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = z.string().trim().email().safeParse(new FormData(e.currentTarget).get("email"));
    if (!email.success) return setError("Enter a valid email");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("Check your email for a reset link.");
    setMode("signin");
  }

  async function onGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return setError(result.error.message ?? "Google sign-in failed");
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-auth lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo inverted />
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-tight">“Set it up in minutes. Run the whole project from one screen.”</p>
          <p className="mt-4 text-sm text-sidebar-foreground/70">Tasks · Milestones · Risks · Issues</p>
        </blockquote>
        <p className="text-xs text-sidebar-foreground/60">For teams of 2 to 30 people.</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          {sentTo ? (
            <div className="rounded-xl border bg-card p-6 shadow-card">
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to finish creating your account.
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => { setSentTo(null); setMode("signin"); }}>
                Back to sign in
              </Button>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={onForgot} className="space-y-4" noValidate>
              <h1 className="text-2xl font-semibold">Reset your password</h1>
              <Field id="forgot-email" name="email" label="Email" type="email" autoComplete="email" />
              {error && <FormError message={error} />}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Send reset link
              </Button>
              <button type="button" onClick={() => setMode("signin")} className="w-full text-sm text-muted-foreground hover:text-foreground">
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to your project." : "Start running your project in minutes."}
              </p>

              <Button type="button" variant="outline" className="mt-6 w-full" onClick={onGoogle}>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <Tabs value={mode} onValueChange={(v) => { setError(null); setMode(v as "signin" | "signup"); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={onSignIn} className="mt-4 space-y-4" noValidate>
                    <Field id="si-email" name="email" label="Email" type="email" autoComplete="email" />
                    <Field id="si-password" name="password" label="Password" type="password" autoComplete="current-password" />
                    {error && <FormError message={error} />}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />} Sign in
                    </Button>
                    <button type="button" onClick={() => setMode("forgot")} className="w-full text-sm text-muted-foreground hover:text-foreground">
                      Forgot password?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={onSignUp} className="mt-4 space-y-4" noValidate>
                    <Field id="su-name" name="fullName" label="Full name" autoComplete="name" />
                    <Field id="su-email" name="email" label="Email" type="email" autoComplete="email" />
                    <Field id="su-password" name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters" />
                    {error && <FormError message={error} />}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />} Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-health-red-soft px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
