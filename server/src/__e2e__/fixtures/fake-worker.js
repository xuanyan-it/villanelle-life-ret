const readline = require("node:readline");

process.stdout.write(`${JSON.stringify({ type: "ready", ok: true })}\n`);

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = String(line || "").trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ id: null, ok: false, error: `bad json: ${String(error)}` })}\n`
    );
    return;
  }

  const id = message && message.id != null ? String(message.id) : null;
  if (!message || message.cmd !== "predict") {
    process.stdout.write(`${JSON.stringify({ id, ok: false, error: "unknown cmd" })}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify({ id, ok: true, result: 0.75 })}\n`);
});
