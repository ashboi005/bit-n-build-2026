import { expect, test } from "bun:test";

test("compare page isolates search-parameter components behind Suspense", async () => {
  const source = await Bun.file(new URL("./page.tsx", import.meta.url)).text();

  expect(source).toContain('import { Suspense } from "react"');
  expect(source).toContain("<Suspense fallback={null}>");
  expect(source).toContain("<ComparePicker />");
  expect(source).toContain("<CompareTable />");
});
