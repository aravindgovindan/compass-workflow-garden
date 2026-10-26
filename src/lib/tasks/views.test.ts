import { describe, expect, it } from "vitest";
import { parseTaskSearch, toFilters } from "./view-params";
import { applyMove, columnCards, dropPosition } from "./board";
import { assertOwnView, isOwnView } from "./views";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("filter parsing from URL params", () => {
  it("reads valid filters, sort and grouping", () => {
    const s = parseTaskSearch({ q: "login", status: [A], assignee: ["none", B], overdue: true, dueFrom: "2026-01-01", cf: { team: "Ops" }, sort: "due_date", dir: "desc", group: "status" });
    expect(toFilters(s)).toMatchObject({ q: "login", status: [A], assignee: ["none", B], overdue: true, dueFrom: "2026-01-01", cf: { team: "Ops" } });
    expect([s.sort, s.dir, s.group]).toEqual(["due_date", "desc", "status"]);
  });
  it("drops invalid ids, dates, keys and unknown groupings instead of failing", () => {
    const s = parseTaskSearch({ status: ["nope", A, A], dueTo: "tomorrow", cf: { "Bad Key": "x", ok: "" }, group: "weird", dir: "sideways", overdue: "yes" });
    expect(s.status).toEqual([A]);
    expect(s.dueTo).toBeUndefined();
    expect(s.cf).toEqual({});
    expect(s.group).toBe("phase");
    expect(s.dir).toBe("asc");
    expect(s.overdue).toBe(false);
  });
  it("defaults to no filters when the URL is empty", () => {
    const f = toFilters(parseTaskSearch({}));
    expect(f).toMatchObject({ q: "", status: [], label: [], overdue: false, cf: {} });
  });
});

describe("board move ordering", () => {
  const rows = [
    { id: "a", status_id: "todo", position: 0 },
    { id: "b", status_id: "todo", position: 1 },
    { id: "c", status_id: "todo", position: 2 },
    { id: "x", status_id: "doing", position: 5 },
  ];
  it("drops between two cards using the midpoint", () => {
    expect(dropPosition(rows, "x", "todo", 1)).toBe(0.5);
  });
  it("drops at the top and the end of a column", () => {
    expect(dropPosition(rows, "x", "todo", 0)).toBe(-1);
    expect(dropPosition(rows, "x", "todo", 99)).toBe(3);
  });
  it("reorders within a column ignoring the moving card", () => {
    // move a to the end of todo: others are b(1), c(2)
    expect(dropPosition(rows, "a", "todo", 2)).toBe(3);
    // move c to the top
    expect(dropPosition(rows, "c", "todo", 0)).toBe(-1);
  });
  it("into an empty column gets position 0", () => {
    expect(dropPosition(rows, "a", "done", 0)).toBe(0);
  });
  it("applies the move and re-sorts the column", () => {
    const next = applyMove(rows, "x", "todo", 0.5);
    expect(columnCards(next, "todo").map((r) => r.id)).toEqual(["a", "x", "b", "c"]);
    expect(columnCards(next, "doing")).toEqual([]);
  });
});

describe("saved view ownership", () => {
  it("only the creator owns a view", () => {
    expect(isOwnView({ user_id: A }, A)).toBe(true);
    expect(isOwnView({ user_id: A }, B)).toBe(false);
    expect(isOwnView(null, A)).toBe(false);
  });
  it("editing someone else's view is refused", () => {
    expect(() => assertOwnView({ user_id: A }, B)).toThrow();
    expect(() => assertOwnView({ user_id: A }, A)).not.toThrow();
  });
});
