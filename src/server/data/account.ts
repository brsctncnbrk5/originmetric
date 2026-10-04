import { and, eq, isNull } from "drizzle-orm";
import { projects, workspaceMembers } from "@/server/db/schema";
import type { Executor } from "@/server/db/client";
import { createProject, type CreateProjectInput } from "@/server/tenancy/projects";
import { systemClock } from "@/server/time/clock";
import { getAuth } from "./auth";
import { getDbHandle } from "./connection";
import { ProjectNotFound, authorizeProject, forProject } from "./project";
export async function currentSession(headers: Headers) {
  return getAuth().api.getSession({ headers });
}
export async function listMemberProjects(db: Executor, userId: string) {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), isNull(projects.deletedAt)));
}
export async function createMemberProject(db: Executor, userId: string, input: CreateProjectInput) {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .for("update");
    if (!member) throw new ProjectNotFound();
    // Ignore workspaceId and workspaceName from request input; membership is authoritative.
    return createProject(tx, { ...input, workspaceId: member.workspaceId }, systemClock);
  });
}
export async function accountProjects(headers: Headers) {
  const session = await currentSession(headers);
  if (!session) return null;
  return { session, projects: await listMemberProjects(getDbHandle().db, session.user.id) };
}
export async function accountProject(headers: Headers, id: string) {
  const session = await currentSession(headers);
  if (!session) return null;
  return forProject(await authorizeProject(getDbHandle().db, session.user.id, id));
}
export async function accountCreateProject(headers: Headers, input: CreateProjectInput) {
  const session = await currentSession(headers);
  if (!session) throw new ProjectNotFound();
  return createMemberProject(getDbHandle().db, session.user.id, input);
}
