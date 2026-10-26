import { useCallback } from "react";
import { useProjectConfig } from "@/lib/config/use-config";
import { resolveTerm, type TermForm, type TermKey } from "./defaults";

/**
 * Project terminology for UI labels: `term("task")` → "Tasks", `term("task", "singular")` → "Task".
 * Falls back to the default label while loading or when a term is missing.
 */
export function useTerm() {
  const { data } = useProjectConfig();
  const terms = data?.terms;
  return useCallback((key: TermKey, form: TermForm = "plural") => resolveTerm(terms, key, form), [terms]);
}
