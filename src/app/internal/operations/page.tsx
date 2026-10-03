import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isInternalRequestAuthorized } from "@/server/internal/auth";
import { readOperations } from "@/server/operations/snapshot";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  if (!isInternalRequestAuthorized((await headers()).get("authorization"))) notFound();
  const snapshot = await readOperations();
  return (
    <main>
      <h1>Operations</h1>
      <p>
        VPS observations do not independently prove uptime. Missing or stale evidence is not
        healthy.
      </p>
      {!snapshot && <p>Monitoring evidence unavailable.</p>}
      <h2>Current observations</h2>
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Source</th>
            <th>Observed</th>
          </tr>
        </thead>
        <tbody>
          {snapshot?.checks.map((check, i) => (
            <tr key={i}>
              <td>{check.name}</td>
              <td>{check.stale ? "stale" : check.status}</td>
              <td>{check.source}</td>
              <td>{check.observedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Observation / alert history</h2>
      <ul>
        {snapshot?.history.map((check, i) => (
          <li key={i}>
            {check.observedAt} · {check.name} · {check.status} · {check.source}
          </li>
        ))}
      </ul>
      <p>
        This dashboard is unavailable when its VPS is down; consult external GitHub run history
        then.
      </p>
    </main>
  );
}
