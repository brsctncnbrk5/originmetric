import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { accountProject } from "@/server/data/account";
import { ProjectNotFound } from "@/server/data/project";
import { ProjectForm, KeyControls } from "../../controls";
export const dynamic = "force-dynamic";
async function load(id: string) {
  try {
    const data = await accountProject(await headers(), id);
    if (!data) redirect("/sign-in");
    return { project: await data.project(), keys: await data.keys() };
  } catch (error) {
    if (error instanceof ProjectNotFound) notFound();
    throw error;
  }
}
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, keys } = await load(id);
  return (
    <main>
      <Link href="/dashboard">All projects</Link>
      <h1>{project.name}</h1>
      <p>
        Public site key: <code>{project.siteKey}</code>
      </p>
      <h2>Project settings</h2>
      <ProjectForm id={id} initial={project} />
      <h2>Server API keys</h2>
      <KeyControls id={id} keys={keys.map((k) => ({ ...k, revoked: !!k.revokedAt }))} />
    </main>
  );
}
