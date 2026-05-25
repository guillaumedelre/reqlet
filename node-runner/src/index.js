// Entry point for the Node.js sandbox process.
// Communicates with the Go host via newline-delimited JSON over stdio.
import { fileURLToPath } from "node:url";
import { execute } from "./executor.js";

export async function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stderr.write(`invalid JSON: ${line}\n`);
    return;
  }

  const { id, method, params } = message;

  if (method !== "execute") {
    respond(id, null, `unknown method: ${method}`);
    return;
  }

  try {
    const result = await execute(params.script, params.event, params.context ?? {});
    respond(id, result, null);
  } catch (err) {
    respond(id, null, err.message ?? String(err));
  }
}

export function respond(id, result, error) {
  process.stdout.write(JSON.stringify({ id, result, error }) + "\n");
}

// Only start the stdin loop when run directly (not imported by tests).
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  process.stdin.setEncoding("utf8");

  let buffer = "";

  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      handleLine(line);
    }
  });

  process.stdin.on("end", () => process.exit(0));
}
