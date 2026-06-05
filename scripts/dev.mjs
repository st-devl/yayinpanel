import { spawn } from "node:child_process";

const commands = [
  {
    args: ["next", "dev"],
    command: npmExecutable(),
    name: "web"
  },
  {
    args: [
      "--conditions=react-server",
      "--env-file=.env",
      "--import",
      "tsx",
      "scheduler.ts"
    ],
    command: process.execPath,
    name: "scheduler"
  }
];

const children = commands.map(startProcess);
let shuttingDown = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

function startProcess({ args, command, name }) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => writePrefixed(name, chunk, "stdout"));
  child.stderr.on("data", (chunk) => writePrefixed(name, chunk, "stderr"));
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[dev:${name}] exited with ${reason}`);
    shutdown("SIGTERM", code ?? 1);
  });

  return child;
}

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
}

function writePrefixed(name, chunk, stream) {
  const target = stream === "stderr" ? process.stderr : process.stdout;
  const lines = chunk.toString().split(/\r?\n/);

  for (const line of lines) {
    if (line) {
      target.write(`[${name}] ${line}\n`);
    }
  }
}

function npmExecutable() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
