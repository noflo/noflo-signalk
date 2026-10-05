// Smoke tests for the signalk/RunDailyAt generator component.
// Drives the component via NoFlo internal sockets against a mock Signal K app.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const noflo = require("noflo");
const { getComponent } = require("../apiComponents/RunDailyAt");

const tick = () => new Promise((resolve) => setImmediate(resolve));

function createApp(self = {}) {
  const listeners = new Map();
  return {
    self,
    getSelfPath: (path) => self[path],
    streambundle: {
      getSelfStream: (path) => ({
        forEach: (callback) => {
          if (!listeners.has(path)) {
            listeners.set(path, new Set());
          }
          listeners.get(path).add(callback);
          return () => listeners.get(path).delete(callback);
        },
      }),
    },
    emit(path, value) {
      for (const callback of listeners.get(path) ?? []) callback(value);
    },
    listenerCount: (path) => listeners.get(path)?.size ?? 0,
  };
}

async function startComponent(app, times) {
  const c = getComponent(app)();
  const fired = [];
  const errors = [];
  const outSocket = noflo.internalSocket.createSocket();
  outSocket.on("data", (data) => fired.push(data));
  const errorSocket = noflo.internalSocket.createSocket();
  errorSocket.on("data", (data) => errors.push(data));
  c.outPorts.out.attach(outSocket);
  c.outPorts.error.attach(errorSocket);
  const timeSocket = noflo.internalSocket.createSocket();
  c.inPorts.time.attach(timeSocket);
  timeSocket.send(times);
  await tick();
  return { c, fired, errors, app };
}

test("fires as catch-up when the configured time has passed, once per day", async () => {
  const app = createApp({
    "navigation.datetime": "2024-06-11T12:00:00.000Z",
    "environment.time.timezoneOffset": 200, // UTC+2, local 14:00
  });
  const { fired, c } = await startComponent(app, "14:00");
  assert.equal(fired.length, 1);

  // Further datetime updates on the same local day must not refire
  app.emit("navigation.datetime", "2024-06-11T13:00:00.000Z");
  await tick();
  assert.equal(fired.length, 1);

  // Next local day fires again
  app.emit("navigation.datetime", "2024-06-12T12:00:00.000Z");
  await tick();
  assert.equal(fired.length, 2);
  c.tearDown(() => {});
});

test("does not evaluate before the timezone offset is known", async () => {
  const app = createApp({
    "navigation.datetime": "2024-06-11T15:00:00.000Z",
    // No timezone offset yet: UTC 15:00 would look past 14:00
  });
  const { fired, c } = await startComponent(app, "14:00");
  await tick();
  assert.equal(fired.length, 0);

  // Offset arrives, but local time (17:00 with -9:30) is before 14:00... UTC-9:30
  // puts local at 05:30, so still no firing
  app.emit("environment.time.timezoneOffset", -930);
  await tick();
  assert.equal(fired.length, 0);

  // Offset UTC+2 puts local at 17:00, past the configured time
  app.emit("environment.time.timezoneOffset", 200);
  await tick();
  assert.equal(fired.length, 1);
  c.tearDown(() => {});
});

test("supports multiple configured times", async () => {
  const app = createApp({
    "navigation.datetime": "2024-06-11T06:00:00.000Z",
    "environment.time.timezoneOffset": 200, // local 08:00
  });
  const { fired, c } = await startComponent(app, ["07:00", "19:00"]);
  // 07:00 has passed, fires as catch-up; 19:00 not yet
  assert.equal(fired.length, 1);

  app.emit("navigation.datetime", "2024-06-11T17:30:00.000Z"); // local 19:30
  await tick();
  assert.equal(fired.length, 2);
  c.tearDown(() => {});
});

test("invalid time configuration goes to error without subscribing", async () => {
  const app = createApp();
  const { fired, errors, app: mockApp } = await startComponent(app, "25:99");
  await tick();
  assert.equal(fired.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Invalid time configuration/);
  assert.equal(mockApp.listenerCount("navigation.datetime"), 0);
  assert.equal(mockApp.listenerCount("environment.time.timezoneOffset"), 0);
});

test("invalid datetime is reported and recovers on the next update", async () => {
  const app = createApp({
    "navigation.datetime": "not a date",
    "environment.time.timezoneOffset": 200,
  });
  const { fired, errors, app: mockApp } = await startComponent(app, "14:00");
  await tick();
  assert.equal(fired.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Invalid datetime/);

  mockApp.self["navigation.datetime"] = "2024-06-11T12:00:00.000Z";
  mockApp.emit("navigation.datetime", "2024-06-11T12:00:00.000Z");
  await tick();
  assert.equal(fired.length, 1);
});

test("tearDown unsubscribes from the Signal K streams", async () => {
  const app = createApp({
    "navigation.datetime": "2024-06-11T12:00:00.000Z",
    "environment.time.timezoneOffset": 200,
  });
  const { fired, c, app: mockApp } = await startComponent(app, "14:00");
  assert.equal(mockApp.listenerCount("navigation.datetime"), 1);
  assert.equal(mockApp.listenerCount("environment.time.timezoneOffset"), 1);

  await new Promise((resolve) => c.tearDown(resolve));
  assert.equal(mockApp.listenerCount("navigation.datetime"), 0);
  assert.equal(mockApp.listenerCount("environment.time.timezoneOffset"), 0);

  // Updates after teardown must not fire
  mockApp.emit("navigation.datetime", "2024-06-12T12:00:00.000Z");
  await tick();
  assert.equal(fired.length, 1);
});
