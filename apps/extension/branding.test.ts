import { expect, test } from "bun:test";

test("extension surfaces use the THWIP brand", async () => {
  const [manifestSource, sidepanelSource] = await Promise.all([
    Bun.file(new URL("./wxt.config.ts", import.meta.url)).text(),
    Bun.file(new URL("./entrypoints/sidepanel/index.html", import.meta.url)).text(),
  ]);

  expect(manifestSource).toContain('name: "THWIP — Private Alpha"');
  expect(manifestSource).toContain('default_title: "Analyze with THWIP"');
  expect(sidepanelSource).toContain("<title>THWIP</title>");
  expect(sidepanelSource).toContain("<strong>THWIP</strong>");
  expect(`${manifestSource}\n${sidepanelSource}`).not.toContain("Mind Over Money");
});
