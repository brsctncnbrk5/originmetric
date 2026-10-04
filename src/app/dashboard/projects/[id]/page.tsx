import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { accountProject } from "@/server/data/account";
import { ProjectNotFound } from "@/server/data/project";
import { ProjectForm, KeyControls } from "../../controls";
import { Installation } from "./installation";
import { trackerSnippet } from "@/server/installation/snippet";
export const dynamic = "force-dynamic";
async function load(id: string) {
  try {
    const data = await accountProject(await headers(), id);
    if (!data) redirect("/sign-in");
    return {
      project: await data.project(),
      keys: await data.keys(),
      installation: await data.installationStatus(),
    };
  } catch (error) {
    if (error instanceof ProjectNotFound) notFound();
    throw error;
  }
}
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, keys, installation } = await load(id);
  return (
    <main>
      <Link href="/dashboard">All projects</Link>
      <h1>{project.name}</h1>
      <p>
        Public site key: <code>{project.siteKey}</code>
      </p>
      <Installation
        id={id}
        initial={installation}
        snippet={
          process.env.BETTER_AUTH_URL
            ? trackerSnippet(process.env.BETTER_AUTH_URL, project.siteKey)
            : null
        }
      />
      <h2>Project settings</h2>
      <ProjectForm id={id} initial={project} />
      <h2>Server API keys</h2>
      <KeyControls id={id} keys={keys.map((k) => ({ ...k, revoked: !!k.revokedAt }))} />
    </main>
  );
}
