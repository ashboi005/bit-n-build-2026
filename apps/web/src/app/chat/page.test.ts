import { expect, test } from "bun:test";

test("chat page isolates search-parameter rendering behind Suspense", async () => {
  const source = await Bun.file(new URL("./page.tsx", import.meta.url)).text();

  expect(source).toContain('import React, { Suspense, useState, useEffect } from "react"');
  expect(source).toContain("function ChatPageContent()");
  expect(source).toContain("<Suspense fallback={null}>");
  expect(source).toContain("<ChatPageContent />");
});
