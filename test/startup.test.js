// Smoke tests for runtime startup status reporting.
// Uses the built-in Node.js test runner: `node --test test/startup.js`
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtemp, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const pluginFactory = require("../index");

const TEST_TIMEOUT = 30000;

async function createApp() {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "noflo-signalk-"));
  // The plugin uses dataDirPath/../../ as its component baseDir
  const dataDir = path.join(tmpRoot, "plugin-config-data", "noflo-signalk");
  // In production Signal K keeps a package.json in ~/.signalk, and
  // noflo-nodejs expects to find one in the baseDir
  await writeFile(
    path.join(tmpRoot, "package.json"),
    JSON.stringify({
      name: "signalk-smoke-test",
      version: "0.0.0",
    }),
  );
  const app = {
    statuses: [],
    debug: () => {},
    getSelfPath: (p) => (p === "name" ? "Smoke test vessel" : undefined),
    getDataDirPath: () => dataDir,
    setPluginStatus: (message) => {
      app.statuses.push({ type: "status", message });
    },
    setPluginError: (message) => {
      app.statuses.push({ type: "error", message });
    },
  };
  return app;
}

async function writeGraphs(app, graphs) {
  const graphsDir = path.join(app.getDataDirPath(), "..", "..", "graphs");
  await mkdir(graphsDir, { recursive: true });
  await Promise.all(
    Object.entries(graphs).map(([name, graph]) =>
      writeFile(path.join(graphsDir, name), JSON.stringify(graph)),
    ),
  );
}

function lastEvent(app) {
  return app.statuses[app.statuses.length - 1];
}

test("failure to start the main graph is reported to Signal K", {
  timeout: TEST_TIMEOUT,
}, async () => {
  const app = await createApp();
  await writeGraphs(app, {
    "main.json": {
      properties: { name: "main", environment: { type: "noflo-nodejs" } },
      processes: {
        Missing: { component: "signalk/NoSuchComponent" },
      },
      connections: [],
    },
  });
  const p = pluginFactory(app);
  await p.start({ port: 0 });
  assert.equal(
    lastEvent(app).type,
    "error",
    `expected error status, got: ${lastEvent(app).message}`,
  );
  assert.match(lastEvent(app).message, /Failed to start main graph main/);
  await p.stop();
});

test("failure to prepare graphs is reported to Signal K", {
  timeout: TEST_TIMEOUT,
}, async () => {
  const app = await createApp();
  const graphsDir = path.join(app.getDataDirPath(), "..", "..", "graphs");
  // A file where the graphs directory should be makes readdir fail with ENOTDIR
  await mkdir(path.dirname(graphsDir), { recursive: true });
  await writeFile(graphsDir, "not a directory");
  const p = pluginFactory(app);
  await p.start({ port: 0 });
  assert.equal(
    lastEvent(app).type,
    "error",
    `expected error status, got: ${lastEvent(app).message}`,
  );
  assert.match(lastEvent(app).message, /Failed to prepare NoFlo graphs/);
  await p.stop();
});

test("successful startup is reported to Signal K", {
  timeout: TEST_TIMEOUT,
}, async () => {
  const app = await createApp();
  const p = pluginFactory(app);
  await p.start({ port: 0 });
  assert.equal(
    lastEvent(app).type,
    "status",
    `expected status, got: ${lastEvent(app).message}`,
  );
  assert.match(lastEvent(app).message, /NoFlo runtime running in port \d+/);
  await p.stop();
});
