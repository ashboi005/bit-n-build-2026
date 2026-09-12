export function isTrustedExtensionSender(
  senderId: string | undefined,
  extensionId: string | undefined,
): boolean {
  return Boolean(senderId && extensionId && senderId === extensionId);
}
