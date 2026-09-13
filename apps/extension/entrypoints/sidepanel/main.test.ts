import { expect, test } from "bun:test";

test("side panel observes session storage changes through the browser storage event", async () => {
  const source = await Bun.file(new URL("./main.ts", import.meta.url)).text();

  expect(source).toContain("browser.storage.onChanged.addListener((changes, areaName) => {");
  expect(source).toContain('if (areaName !== "session") return;');
  expect(source).not.toContain("browser.storage.session.onChanged");
});
