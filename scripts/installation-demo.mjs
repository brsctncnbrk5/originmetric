// Repeatable, disposable experiment. Never reads production DB credentials.
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
const name = `om-installation-${randomBytes(6).toString("hex")}`;
const password = randomBytes(24).toString("hex");
let started = false;
const run = (cmd, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code})`)),
    );
  });
try {
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      name,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=om_fixture",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      "POSTGRES_DB=om_fixture",
      "postgres:18.6-alpine",
    ],
    { stdio: "ignore" },
  );
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      execFileSync("docker", ["exec", name, "pg_isready", "-U", "om_fixture"], { stdio: "ignore" });
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error("Fixture database did not become ready");
  const dbPort = execFileSync("docker", ["port", name, "5432"], { encoding: "utf8" })
    .trim()
    .split(":")
    .at(-1);
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const appPort = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = {
    ...process.env,
    DATABASE_URL: `postgres://om_fixture:${password}@127.0.0.1:${dbPort}/om_fixture`,
    E2E_PORT: String(appPort),
    INTERNAL_TOKEN: randomBytes(32).toString("hex"),
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: `http://127.0.0.1:${appPort}`,
    INGEST_PROXY_MODE: "local",
    CI: "1",
  };
  await run("npm", ["run", "db:migrate"], env);
  await run("npm", ["run", "build"], env);
  await run("npx", ["playwright", "test", "tests/e2e/installation.spec.ts", "--workers=1"], env);
} catch {
  // execFile errors may contain env arguments. Do not serialize error objects/commands.
  console.error("Isolated installation demo failed. Check preceding command output.");
  process.exitCode = 1;
} finally {
  if (started) execFileSync("docker", ["rm", "-f", "-v", name], { stdio: "ignore" });
}
