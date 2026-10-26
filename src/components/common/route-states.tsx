import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { friendlyError } from "@/lib/errors";

export function PagePending() {
  return <div role="status" aria-label="Loading page" className="space-y-4 p-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /><span className="sr-only">Loading…</span></div>;
}
export function PageNotFound() {
  return <main className="flex min-h-[60vh] items-center justify-center px-6"><div className="max-w-md text-center"><p className="text-7xl font-bold">404</p><h1 className="mt-4 text-xl font-semibold">Page not found</h1><p className="mt-2 text-sm text-muted-foreground">This page does not exist or has moved.</p><Button asChild className="mt-6"><Link to="/dashboard">Go to dashboard</Link></Button></div></main>;
}
export function PageError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "compass_route" }); }, [error]);
  return <main role="alert" className="flex min-h-[60vh] items-center justify-center px-6"><div className="max-w-md text-center"><h1 className="text-xl font-semibold">This page didn’t load</h1><p className="mt-2 text-sm text-muted-foreground">{friendlyError(error, "Something went wrong. Please try again.")}</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button onClick={async () => { await router.invalidate(); reset(); }}>Try again</Button><Button asChild variant="outline"><Link to="/dashboard">Go to dashboard</Link></Button><Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button></div></div></main>;
}