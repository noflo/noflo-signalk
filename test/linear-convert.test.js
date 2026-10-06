// Smoke tests for the signalk/LinearConvert component.
// Drives the component via NoFlo internal sockets.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const noflo = require("noflo");
const { getComponent } = require("../components/LinearConvert");

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function setup(controls = {}) {
  const c = getComponent();
  const outputs = [];
  const inSocket = noflo.internalSocket.createSocket();
  const outSocket = noflo.internalSocket.createSocket();
  outSocket.on("data", (data) => outputs.push(data));
  c.inPorts.in.attach(inSocket);
  c.outPorts.out.attach(outSocket);
  const controlSockets = {};
  for (const [port, value] of Object.entries(controls)) {
    const socket = noflo.internalSocket.createSocket();
    c.inPorts[port].attach(socket);
    socket.send(value);
    socket.disconnect();
    controlSockets[port] = socket;
  }
  await tick();
  const send = (value) => {
    inSocket.send(value);
    inSocket.disconnect();
  };
  return { c, outputs, send };
}

test("passes values through unchanged by default", async (t) => {
  const { outputs, send } = await setup();
  send(5);
  await tick();
  assert.deepEqual(outputs, [5]);
});

test("applies offset and scale", async (t) => {
  // Bilge current sensor: (1.51 V - 1.46 V) / 0.0596 V/A
  const { outputs, send } = await setup({ offset: 1.46, scale: 0.0596 });
  send(1.51);
  await tick();
  assert.equal(outputs.length, 1);
  assert.ok(Math.abs(outputs[0] - 0.838926) < 0.000001);
});

test("control values persist across packets", async (t) => {
  const { outputs, send } = await setup({ offset: 2, scale: 2 });
  send(6);
  await tick();
  send(8);
  await tick();
  assert.deepEqual(outputs, [2, 3]);
});

test("drops non-numeric readings", async (t) => {
  const { outputs, send } = await setup();
  send("not-a-number");
  await tick();
  assert.deepEqual(outputs, []);
});

test("drops readings that convert to non-finite results", async (t) => {
  const { outputs, send } = await setup({ scale: 0 });
  send(5);
  await tick();
  assert.deepEqual(outputs, []);
});

test("unusable control values fall back to defaults", async (t) => {
  const { outputs, send } = await setup({ offset: "NaN", scale: null });
  send(5);
  await tick();
  assert.deepEqual(outputs, [5]);
});
