import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { internalProjectData, ProjectNotFound } from "@/server/data/project";

export const dynamic = "force-dynamic";

export default async function InternalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestHeaders = await headers();
  const { project, rows } = await internalProjectData(requestHeaders.get("authorization"), id)
    .then(async (data) => ({ project: await data.project(), rows: await data.customerRows() }))
    .catch((error: unknown) => {
      if (error instanceof ProjectNotFound) notFound();
      throw error;
    });

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
