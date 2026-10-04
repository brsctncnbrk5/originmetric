import { BodyTooLarge, readBoundedBody } from "@/server/http/bounded-body";
import { z } from "zod";
import { accountCreateProject, accountProject, accountProjects } from "@/server/data/account";
import { ProjectNotFound } from "@/server/data/project";
import { ProjectInputError } from "@/server/tenancy/projects";
import { systemClock } from "@/server/time/clock";
const config = z.object({
  name: z.string(),
  allowedDomains: z.array(z.string()).max(100),
  timezone: z.string(),
  primaryCurrency: z.string(),
  excludedReferrers: z.array(z.string()).max(100).optional(),
});
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), config }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("create-key"), name: z.string().min(1).max(100) }),
  z.object({ action: z.enum(["rotate-key", "revoke-key"]), keyId: z.string().uuid() }),
]);
export async function accountHttp(request: Request, id?: string) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (request.method !== "GET") {
      if (
        !process.env.BETTER_AUTH_URL ||
        request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL).origin
      )
        return reply({ message: "Invalid origin" }, 403);
      if (Number(request.headers.get("content-length") ?? 0) > 16384)
        return reply({ message: "Request too large" }, 413);
    }
    if (!id) {
      if (request.method === "GET") {
        const result = await accountProjects(request.headers);
        return result ? reply(result.projects) : reply({ message: "Not found" }, 404);
      }
      const input = config.parse(
        JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 16384))),
      );
      return reply(await accountCreateProject(request.headers, input), 201);
    }
    const data = await accountProject(request.headers, id);
    if (!data) throw new ProjectNotFound();
    if (request.method === "GET")
      return reply({
        project: await data.project(),
        keys: await data.keys(),
        installation: await data.installationStatus(),
      });
    const input = mutation.parse(
      JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 16384))),
    );
    switch (input.action) {
      case "update":
        return reply(await data.update(input.config, systemClock));
      case "delete":
        await data.delete(systemClock);
        break;
      case "create-key":
        return reply(await data.createKey(input.name, systemClock));
      case "rotate-key":
        return reply(await data.rotateKey(input.keyId, systemClock));
      case "revoke-key":
        await data.revokeKey(input.keyId, systemClock);
        break;
    }
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLarge) return reply({ message: "Request too large" }, 413);
    if (error instanceof ProjectNotFound) return reply({ message: "Not found" }, 404);
    if (
      error instanceof z.ZodError ||
      error instanceof ProjectInputError ||
      error instanceof SyntaxError
    )
      return reply({ message: "Invalid project settings or request." }, 400);
    return reply({ message: "Request could not be completed." }, 503);
  }
}
