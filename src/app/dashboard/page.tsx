import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { accountProjects } from "@/server/data/account";
import { AccountControls, ProjectForm } from "./controls";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL)
    return (
      <main>
        <h1>Accounts unavailable</h1>
        <p>Authentication requires administrator setup.</p>
      </main>
    );
  const data = await accountProjects(await headers());
  if (!data) redirect("/sign-in");
  return (
    <main>
      <h1>Your projects</h1>
      <p>Signed in as {data.session.user.email}</p>
      <p>Email {data.session.user.emailVerified ? "verified" : "not verified"}</p>
      <AccountControls email={data.session.user.email} />
      <ul>
        {data.projects.map((p) => (
          <li key={p.id}>
            <Link href={`/dashboard/projects/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
      <h2>Create project</h2>
      <ProjectForm />
    </main>
  );
}
