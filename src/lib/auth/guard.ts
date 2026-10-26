import { redirect } from "@tanstack/react-router";
import type { CurrentUser } from "@/functions/session.functions";
import { canAccessSection, type Section } from "./roles";

/** Route `beforeLoad` guard: sends users without access back to the dashboard. */
export function guardSection(section: Section) {
  return ({ context }: { context: { me: CurrentUser } }) => {
    if (!canAccessSection(context.me.membership?.role ?? null, section)) {
      throw redirect({ to: "/dashboard" });
    }
  };
}
