import type { ThesisEvent, DiscoveryEvent } from "@bit-n-build-2026/contracts";
import { ENV } from "@/env";

export async function* streamThesis(
  query: string,
  signal?: AbortSignal,
): AsyncGenerator<ThesisEvent | DiscoveryEvent> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/thesis/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      yield JSON.parse(line.slice(6)) as ThesisEvent | DiscoveryEvent;
    }
  }
}
