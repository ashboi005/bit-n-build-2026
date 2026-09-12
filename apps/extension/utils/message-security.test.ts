import { expect, test } from "bun:test";

import { isTrustedExtensionSender } from "./message-security";

test("accepts messages only from this extension", () => {
  expect(isTrustedExtensionSender("private-alpha-id", "private-alpha-id")).toBe(true);
  expect(isTrustedExtensionSender("another-extension", "private-alpha-id")).toBe(false);
});

test("rejects messages without a sender identity", () => {
  expect(isTrustedExtensionSender(undefined, "private-alpha-id")).toBe(false);
  expect(isTrustedExtensionSender("private-alpha-id", undefined)).toBe(false);
});
