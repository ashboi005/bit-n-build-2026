/**
 * Demo seed script.
 *
 *   bun run --filter server seed:demo <email> <day0|day5|day15|day25>
 *
 * Writes a real row into `user_profile` for a real user. Nothing about the
 * investigation is seeded — see the warning below.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE PIPELINE ALWAYS RUNS.
 *
 *  This script seeds STATE ONLY: what the user knows, what they hold, and which
 *  of their past theses held up or broke. It does not pre-compute findings, it
 *  does not cache a verdict, and there is no playback mode anywhere in the
 *  codebase.
 *
 *  When the demo runs, /api/thesis/stream executes the same eight stages, calls
 *  the same model, retrieves from the same sources and applies the same citation
 *  guards as it would for any user. The seeded profile only changes how deeply
 *  things are explained.
 *
 *  If a judge types their own question instead of the suggested one, it works
 *  exactly the same way. That is the point.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { DEMO_STAGES, type DemoStage } from "@bit-n-build-2026/contracts";
import { user } from "@bit-n-build-2026/db/schema/auth";
import { eq } from "drizzle-orm";

import { DEMO_PROMPTS } from "./demo-personas";
import { getDb, seedProfile } from "./services";

const [email, stageArg] = process.argv.slice(2);

if (!email) {
  console.error("Usage: bun run src/seed-demo.ts <email> [day0|day5|day15|day25]");
  console.error("       (sign up through the app first, then seed that account)");
  process.exit(1);
}

const stage: DemoStage = (DEMO_STAGES as readonly string[]).includes(stageArg ?? "")
  ? (stageArg as DemoStage)
  : "day0";

const db = getDb();
const [account] = await db.select().from(user).where(eq(user.email, email));

if (!account) {
  console.error(`No user with email ${email}. Sign up through the app first.`);
  process.exit(1);
}

const profile = await seedProfile(account.id, stage);

console.log(`Seeded ${email} -> ${stage}`);
console.log(`  level:          ${profile.level}`);
console.log(`  knownConcepts:  ${profile.knownConcepts.join(", ") || "none"}`);
console.log(`  holdings:       ${profile.holdings.map((h) => h.ticker).join(", ") || "none"}`);
console.log(`  pastTheses:     ${profile.pastTheses.length}`);
console.log(`  suggested ask:  "${DEMO_PROMPTS[stage]}"`);
console.log(`\nThe investigation itself still runs live. Nothing is pre-computed.`);

process.exit(0);
