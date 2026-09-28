/**
 * Server-side identify (plan §7.1b): `{customer_id, visitor_id}` → trusted `server_identify`
 * link + synchronous attribution recompute, in one transaction.
 */
import { z } from "zod";
import type { Database } from "@/server/db/client";
import { recomputeCustomerAttribution } from "@/server/attribution/materialize";
import type { Clock } from "@/server/time/clock";
import { parseWith } from "@/server/http/api";
import { createTrustedLink, upsertAndLockCustomer } from "./customers";
import { customerIdField, visitorIdField } from "./fields";

export const identifyBodySchema = z.strictObject({
  customer_id: customerIdField,
  // The key is required; the value may be null (no cookie → no-op).
  visitor_id: visitorIdField.nullable(),
});

export type IdentifyInput = z.output<typeof identifyBodySchema>;

export type IdentifyOutcome = "linked" | "duplicate" | "skipped";

/** Validate a parsed JSON body. Throws InvalidRequest (422). */
export function parseIdentifyBody(body: unknown): IdentifyInput {
  return parseWith(identifyBodySchema, body);
}

export async function identify(
  db: Database,
  projectId: string,
  input: IdentifyInput,
  clock: Clock,
): Promise<IdentifyOutcome> {
  const visitorId = input.visitor_id;
  // True no-op: no customer and no link are created without a visitor.
  if (visitorId === null) return "skipped";

  return db.transaction(async (tx) => {
    const customer = await upsertAndLockCustomer(tx, projectId, input.customer_id, clock);
    const linked = await createTrustedLink(
      tx,
      { projectId, customerId: customer.id, visitorId, method: "server_identify" },
      clock,
    );
    if (!linked) return "duplicate";
    await recomputeCustomerAttribution(tx, { projectId, customerId: customer.id }, clock);
    return "linked";
  });
}
