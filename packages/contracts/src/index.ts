export * from "./thesis";
export * from "./stocks";
export * from "./profile";
export * from "./activity";
export * from "./discovery";

import type { ThesisEvent } from "./thesis";
import type { DiscoveryEvent } from "./discovery";

/** Everything POST /api/thesis/stream can emit. */
export type StreamEvent = ThesisEvent | DiscoveryEvent;
