const { parentPort, workerData } = require("worker_threads");
const engine = require("../utils/certEngine");

let stopped = false;
parentPort.on("message", (m) => { if (m && m.type === "stop") stopped = true; });

(async () => {
  try {
    const r = await engine.run(workerData, {
      progress: (done, total) => parentPort.postMessage({ type: "progress", done, total }),
      file: (name, path, size) => parentPort.postMessage({ type: "file", name, path, size }),
      isStopped: () => stopped,
    });
    parentPort.postMessage({ type: "done", stopped, total: r.total, sheets: r.sheets });
  } catch (err) {
    parentPort.postMessage({ type: "error", message: err && err.message ? err.message : String(err) });
  }
})();