import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { UatPicker } from "./uat-picker";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/functions/uat.functions", () => ({ getUatAvailability: async () => ({ available: false, projects: [] }) }));
vi.mock("./uat-banner", () => ({ useUatSignIn: () => ({ signIn: vi.fn(), busy: null }) }));

describe("test access availability compatibility", () => {
  it("ignores legacy cached availability without a project identifier", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    qc.setQueryData(["uat-availability"], { available: true, roles: ["owner"] });
    const result = render(<QueryClientProvider client={qc}><UatPicker /></QueryClientProvider>);
    expect(screen.queryByRole("button", { name: "Owner" })).toBeNull();
    result.unmount();
    qc.clear();
  });
  it("safely rejects available responses missing their project list", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    qc.setQueryData(["uat-availability", "projects-v2"], { available: true, roles: ["owner"] });
    const result = render(<QueryClientProvider client={qc}><UatPicker /></QueryClientProvider>);
    expect(screen.queryByRole("button", { name: "Owner" })).toBeNull();
    result.unmount();
    qc.clear();
  });
});