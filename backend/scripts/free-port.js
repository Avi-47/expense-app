const { execSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config();

const port = Number(process.env.PORT || 62000);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`[free-port] Invalid PORT value: ${process.env.PORT}`);
  process.exit(1);
}

const findPidsOnWindows = (targetPort) => {
  const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
    encoding: "utf8"
  });

  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    const state = parts[3];
    const pid = Number(parts[4]);

    if (state === "LISTENING" && Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
};

const killPidWindows = (pid) => {
  execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
};

try {
  if (process.platform !== "win32") {
    // Keep this script safe on non-Windows environments.
    process.exit(0);
  }

  let pids = [];
  try {
    pids = findPidsOnWindows(port);
  } catch {
    // No listeners found for the port.
    process.exit(0);
  }

  if (pids.length === 0) {
    process.exit(0);
  }

  for (const pid of pids) {
    if (pid !== process.pid) {
      try {
        killPidWindows(pid);
        console.log(`[free-port] Freed port ${port} by killing PID ${pid}`);
      } catch (err) {
        console.warn(`[free-port] Failed to kill PID ${pid}: ${err.message}`);
      }
    }
  }
} catch (err) {
  console.warn(`[free-port] Non-fatal error: ${err.message}`);
}
