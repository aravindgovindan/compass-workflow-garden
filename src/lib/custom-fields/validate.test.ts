import { describe, expect, it } from "vitest";
import { validateCustomValues } from "./validate";
import type { CustomFieldDef, CustomFieldType } from "./types";

const def = (type: CustomFieldType, extra: Partial<CustomFieldDef> = {}): CustomFieldDef => ({
  id: type, key: "f", name: "Field", type, options: ["A", "B"], required: false, ...extra,
});
const ok = (d: CustomFieldDef, v: unknown, memberIds?: string[]) => validateCustomValues([d], { f: v }, { memberIds });
const UID = "11111111-1111-4111-8111-111111111111";

describe("custom field validator", () => {
  it("text", () => {
    expect(ok(def("text"), " hi ").values.f).toBe("hi");
    expect(ok(def("text"), 5).ok).toBe(false);
    expect(ok(def("text"), "x".repeat(256)).ok).toBe(false);
  });
  it("long_text", () => {
    expect(ok(def("long_text"), "x".repeat(4000)).ok).toBe(true);
    expect(ok(def("long_text"), "x".repeat(5001)).ok).toBe(false);
  });
  it("number", () => {
    expect(ok(def("number"), 4.5).values.f).toBe(4.5);
    expect(ok(def("number"), "12").values.f).toBe(12);
    expect(ok(def("number"), "abc").ok).toBe(false);
  });
  it("date", () => {
    expect(ok(def("date"), "2026-10-26").ok).toBe(true);
    expect(ok(def("date"), "26/10/2026").ok).toBe(false);
  });
  it("dropdown", () => {
    expect(ok(def("dropdown"), "A").ok).toBe(true);
    expect(ok(def("dropdown"), "C").ok).toBe(false);
  });
  it("multi_select", () => {
    expect(ok(def("multi_select"), ["A", "A", "B"]).values.f).toEqual(["A", "B"]);
    expect(ok(def("multi_select"), ["A", "Z"]).ok).toBe(false);
    expect(ok(def("multi_select"), "A").ok).toBe(false);
  });
  it("user", () => {
    expect(ok(def("user"), UID, [UID]).ok).toBe(true);
    expect(ok(def("user"), UID, []).ok).toBe(false);
    expect(ok(def("user"), "bob").ok).toBe(false);
  });
  it("checkbox", () => {
    expect(ok(def("checkbox", { required: true }), false).ok).toBe(true);
    expect(ok(def("checkbox"), "yes").ok).toBe(false);
  });
  it("url", () => {
    expect(ok(def("url"), "https://example.com").ok).toBe(true);
    expect(ok(def("url"), "javascript:alert(1)").ok).toBe(false);
    expect(ok(def("url"), "not a url").ok).toBe(false);
  });
  it("required fields must be filled; unknown and archived keys are dropped", () => {
    expect(ok(def("text", { required: true }), "").errors.f).toMatch(/required/);
    const r = validateCustomValues([def("text", { archived: true })], { f: "x", other: 1 });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({});
  });
});
