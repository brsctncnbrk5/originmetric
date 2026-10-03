import { and, asc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDbHandle } from "@/server/db/instance";
import { customerAttribution, customers, projects } from "@/server/db/schema";
import { isInternalRequestAuthorized } from "@/server/internal/auth";

export const dynamic = "force-dynamic";

export default async function InternalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  if (
    !z.string().uuid().safeParse(id).success ||
    !isInternalRequestAuthorized(requestHeaders.get("authorization"))
  ) {
    notFound();
  }

  const db = getDbHandle().db;
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)));
  if (!project) notFound();

  const rows = await db
    .select({
      customer: customers.externalId,
      status: customerAttribution.status,
      source: customerAttribution.creditedSource,
    })
    .from(customers)
    .leftJoin(
      customerAttribution,
      and(
        eq(customerAttribution.projectId, customers.projectId),
        eq(customerAttribution.customerId, customers.id),
      ),
    )
    .where(and(eq(customers.projectId, id), isNull(customers.deletedAt)))
    .orderBy(asc(customers.createdAt))
    .limit(100);

  return (
    <main data-testid="internal-result">
      <h1>{project.name}</h1>
      <p>Internal P1b attribution proof. Not product UI.</p>
      <a href="/internal/operations">Operations observations</a>
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Status</th>
            <th>Acquired via</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.customer ?? "deleted"}>
              <td>{row.customer ?? "(deleted)"}</td>
              <td>{row.status ?? "unattributed"}</td>
              <td>{row.source ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
