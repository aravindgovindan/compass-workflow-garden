import { expect, it } from "vitest";
import { fetchAll } from "./task-list.server";
it("exports every row beyond a 1000-row page and 5000-row list cap", async () => {
  const records = Array.from({ length: 6003 }, (_, id) => ({ id }));
  const result = await fetchAll((from, to) =>
    Promise.resolve({ data: records.slice(from, to + 1), error: null }),
  );
  expect(result.rows).toHaveLength(6003);
  expect(result.rows[6002]?.id).toBe(6002);
});
it("retains the list limit when explicitly supplied", async () => {
  const records = Array.from({ length: 6003 }, (_, id) => ({ id }));
  const result = await fetchAll(
    (from, to) => Promise.resolve({ data: records.slice(from, to + 1), error: null }),
    5000,
  );
  expect(result.rows).toHaveLength(5000);
});
