import { createInterface } from "node:readline/promises";
import { createDb } from "@/server/db/client";
import { recoverPassword } from "@/server/data/recovery";
async function hidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const read = (data: Buffer) => {
      for (const char of data.toString("utf8")) {
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " " && value.length < 129) value += char;
      }
    };
    process.stdin.on("data", read);
  });
}
async function main() {
  if (
    process.argv.length !== 2 ||
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    process.getuid?.() !== 0
  )
    throw new Error("Run locally as administrator in an interactive TTY, without arguments.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question("Account email: ");
  rl.close();
  const password = await hidden("New password (hidden): ");
  const confirmation = await hidden("Confirm password (hidden): ");
  if (password !== confirmation) throw new Error("Passwords do not match");
  const db = createDb();
  try {
    await recoverPassword(db.db, email, password);
    process.stdout.write("Password updated; all sessions and reset tokens revoked.\n");
  } finally {
    await db.close();
  }
}
main().catch(() => {
  process.stderr.write("Recovery failed. Check local configuration and account details.\n");
  process.exitCode = 1;
});
