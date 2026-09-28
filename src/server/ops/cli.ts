/**
 * `ops` CLI (plan §2 / §28 P1a): create-project, create-key, recompute. Run by the operator
 * (local dev now, the app container later). No auth/user accounts are involved.
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import type { Database } from "@/server/db/client";
import { createApiKey } from "@/server/tenancy/api-keys";
import { ProjectInputError, createProject, findActiveProject } from "@/server/tenancy/projects";
import type { Clock } from "@/server/time/clock";
import { recomputeCustomerByExternalId, recomputeProject } from "./recompute";

export interface OpsIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export interface OpsDeps extends OpsIo {
  db: Database;
  clock: Clock;
}

export const USAGE = `Usage: npm run ops -- <command> [options]

Commands:
  create-project --name <name> --domain <host> [--domain <host> ...]
                 --timezone <IANA tz> --currency <ISO 4217>
                 [--exclude-referrer <host> ...] [--workspace <uuid> | --workspace-name <name>]
      Create a (development) workspace + project. Prints the project ID and public site key.

  create-key --project <uuid> [--name <label>]
      Create a server API key (scope server:write). The full key is printed exactly once;
      only its prefix and SHA-256 hash are stored.

  recompute --project <uuid> (--all | --customer <external customer id>)
      Rebuild customer attribution deterministically from stored facts.
`;

class UsageError extends Error {}

const uuid = z.uuid();

function requireUuid(value: string | undefined, flag: string): string {
  if (value === undefined) throw new UsageError(`${flag} is required`);
  if (!uuid.safeParse(value).success) throw new UsageError(`${flag} must be a UUID`);
  return value.toLowerCase();
}

function requireString(value: string | undefined, flag: string): string {
  if (value === undefined || value.trim() === "") throw new UsageError(`${flag} is required`);
  return value;
}

async function createProjectCommand(args: string[], deps: OpsDeps): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      name: { type: "string" },
      domain: { type: "string", multiple: true },
      timezone: { type: "string" },
      currency: { type: "string" },
      "exclude-referrer": { type: "string", multiple: true },
      workspace: { type: "string" },
      "workspace-name": { type: "string" },
    },
  });
  const project = await createProject(
    deps.db,
    {
      name: requireString(values.name, "--name"),
      allowedDomains: values.domain ?? [],
      timezone: requireString(values.timezone, "--timezone"),
      primaryCurrency: requireString(values.currency, "--currency"),
      excludedReferrers: values["exclude-referrer"] ?? [],
      workspaceId:
        values.workspace === undefined ? undefined : requireUuid(values.workspace, "--workspace"),
      workspaceName: values["workspace-name"],
    },
    deps.clock,
  );
  deps.out(`workspace_id:       ${project.workspaceId}`);
  deps.out(`project_id:         ${project.projectId}`);
  deps.out(`site_key:           ${project.siteKey}   (public, not a secret)`);
  deps.out(`allowed_domains:    ${project.allowedDomains.join(", ")}`);
  deps.out(`excluded_referrers: ${project.excludedReferrers.join(", ") || "(built-in list only)"}`);
  deps.out(`timezone:           ${project.timezone}`);
  deps.out(`primary_currency:   ${project.primaryCurrency}`);
  return 0;
}

async function createKeyCommand(args: string[], deps: OpsDeps): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: { project: { type: "string" }, name: { type: "string" } },
  });
  const projectId = requireUuid(values.project, "--project");
  if (!(await findActiveProject(deps.db, projectId))) {
    deps.err("error: project not found");
    return 1;
  }
  const name = values.name?.trim() || null;
  if (name !== null && name.length > 100)
    throw new UsageError("--name must be at most 100 characters");
  const created = await createApiKey(deps.db, { projectId, name }, deps.clock);
  deps.out(`key_id:     ${created.id}`);
  deps.out(`project_id: ${created.projectId}`);
  deps.out(`prefix:     ${created.prefix}`);
  deps.out(`scope:      server:write`);
  deps.out("");
  deps.out("Secret key (shown ONCE; it is not stored and cannot be recovered):");
  deps.out(created.key);
  return 0;
}

async function recomputeCommand(args: string[], deps: OpsDeps): Promise<number> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      project: { type: "string" },
      all: { type: "boolean" },
      customer: { type: "string" },
    },
  });
  const projectId = requireUuid(values.project, "--project");
  if (Boolean(values.all) === (values.customer !== undefined)) {
    throw new UsageError("pass exactly one of --all or --customer <id>");
  }
  if (!(await findActiveProject(deps.db, projectId))) {
    deps.err("error: project not found");
    return 1;
  }
  if (values.all) {
    const summary = await recomputeProject(deps.db, projectId, deps.clock);
    deps.out(
      `recomputed ${summary.customers} customer(s): ` +
        `attributed=${summary.byStatus.attributed} direct=${summary.byStatus.direct} ` +
        `unattributed=${summary.byStatus.unattributed}`,
    );
    return 0;
  }
  const result = await recomputeCustomerByExternalId(
    deps.db,
    projectId,
    requireString(values.customer, "--customer"),
    deps.clock,
  );
  if (!result) {
    deps.err("error: customer not found");
    return 1;
  }
  deps.out(
    `recomputed 1 customer: status=${result.status} source=${result.credited?.source ?? "-"}`,
  );
  return 0;
}

const COMMANDS: Record<string, (args: string[], deps: OpsDeps) => Promise<number>> = {
  "create-project": createProjectCommand,
  "create-key": createKeyCommand,
  recompute: recomputeCommand,
};

/** Run one ops command. Returns the process exit code (0 ok, 1 failure, 2 usage). */
export async function runOps(argv: string[], deps: OpsDeps): Promise<number> {
  const [command, ...rest] = argv;
  const run = command === undefined ? undefined : COMMANDS[command];
  if (!run) {
    deps.err(USAGE);
    return 2;
  }
  try {
    return await run(rest, deps);
  } catch (err) {
    if (err instanceof UsageError || (err instanceof TypeError && "code" in err)) {
      deps.err(`error: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    if (err instanceof ProjectInputError) {
      deps.err(`error: ${err.field}: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
