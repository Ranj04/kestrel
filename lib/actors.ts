/**
 * THE demo actor, declared once. Closes R-18.
 *
 * This was two declarations: PRESCRIBER in app/page.tsx and DEMO_ACTORS in
 * app/api/prescribe/route.ts. They agreed, but nothing made them agree — and
 * they feed DIFFERENT records in the same chain. The order record's actor is
 * resolved server-side from the route's copy; the override record's actor is
 * posted by the client from the page's copy. Let those drift and one person
 * appears under two identities in one audit trail, which is precisely the
 * attribution claim 21 CFR 11.50 is about.
 *
 * Same defect class as R-5: two declarations of a closed set, both
 * syntactically fine, silently disagreeing. One declaration, imported by both.
 */
import type { Actor } from "./contracts";

/** DEMO SHIM: a real system resolves the signer from the authenticated session.
 *  There is no auth here, so the demo prescriber is hardcoded — and said to be. */
export const DEMO_ACTORS: Record<string, Actor> = {
  dr_chen: { id: "dr_chen", name: "Dr. Chen", role: "Attending, Oncology" },
};

export const PRESCRIBER: Actor = DEMO_ACTORS.dr_chen;

/** Unknown id -> a plainly-labelled stand-in. Never silently borrows dr_chen's
 *  name: an unrecognised signer must not be attributed to a real one. */
export function actorFor(id: string): Actor {
  return DEMO_ACTORS[id] ?? { id, name: id, role: "Prescriber" };
}
