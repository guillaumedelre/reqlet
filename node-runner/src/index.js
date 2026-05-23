// Entry point for the Node.js sandbox process.
// Communicates with the Go host via newline-delimited JSON over stdio.
process.stdin.setEncoding("utf8");

let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      process.stdout.write(JSON.stringify({ id: message.id, result: null }) + "\n");
    } catch {
      process.stderr.write(`invalid JSON: ${line}\n`);
    }
  }
});
