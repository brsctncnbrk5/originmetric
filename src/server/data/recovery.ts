import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { Database } from "@/server/db/client";
import { account, session, user, verification } from "@/server/db/schema";
/** Local administrator recovery only. Never expose this through HTTP. */
export async function recoverPassword(db: Database, email: string, password: string) {
  if (password.length < 12 || password.length > 128)
    throw new Error("Password must be 12–128 characters");
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email.trim().toLowerCase()))
      .for("update");
    if (!owner) throw new Error("Recovery account unavailable");
    const rows = await tx
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, owner.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (rows.length !== 1) throw new Error("Recovery account unavailable");
    await tx.delete(session).where(eq(session.userId, owner.id));
    await tx.delete(verification).where(eq(verification.identifier, `reset-password:${owner.id}`));
    // Existing reset tokens are indexed by random token, with user ID as value.
    await tx.delete(verification).where(eq(verification.value, owner.id));
  });
}
