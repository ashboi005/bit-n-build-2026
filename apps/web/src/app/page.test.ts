import { expect, test } from "bun:test";

test("home page isolates search-parameter rendering behind Suspense", async () => {
  const source = await Bun.file(new URL("./page.tsx", import.meta.url)).text();

  expect(source).toContain('import { Suspense, useEffect, useState } from "react"');
  expect(source).toContain("function HomeContent()");
  expect(source).toContain("<Suspense fallback={null}>");
  expect(source).toContain("<HomeContent />");
});
