const noflo = require("noflo");

/** Default value subtracted from the input before scaling */
const DEFAULT_OFFSET = 0;

/** Default divisor applied after the offset is removed */
const DEFAULT_SCALE = 1;

/**
 * Coerce a control port value to a finite number, falling back to the
 * port default when it is missing or unusable. NoFlo delivers port
 * defaults via the network layer, so bare instances read undefined.
 *
 * @param {any} value - Raw control port value
 * @param {number} fallback - Default to use when value is not finite
 * @returns {number} Numeric configuration value
 */
function toNumber(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Convert a raw sensor reading to engineering units with a linear
 * calibration: out = (in - offset) / scale. Useful for deriving e.g.
 * amps from a current-sensor voltage path. Readings that do not
 * convert to a finite number (missing input, zero scale) produce no
 * output rather than NaN or Infinity.
 */
exports.getComponent = () => {
  const c = new noflo.Component();
  c.description =
    "Convert a raw sensor reading with a linear calibration: (in - offset) / scale";
  c.icon = "calculator";
  c.inPorts.add("in", {
    datatype: "number",
    description: "Raw sensor reading",
  });
  c.inPorts.add("offset", {
    datatype: "number",
    description: "Sensor output at zero reading, in input units",
    control: true,
    default: DEFAULT_OFFSET,
  });
  c.inPorts.add("scale", {
    datatype: "number",
    description: "Sensor scale, input units per output unit",
    control: true,
    default: DEFAULT_SCALE,
  });
  c.outPorts.add("out", {
    datatype: "number",
    description: "Calibrated reading",
  });
  c.process((input, output) => {
    if (!input.hasData("in")) {
      return;
    }
    const raw = Number(input.getData("in"));
    if (!Number.isFinite(raw)) {
      output.done();
      return;
    }
    const offset = toNumber(input.getData("offset"), DEFAULT_OFFSET);
    const scale = toNumber(input.getData("scale"), DEFAULT_SCALE);
    const result = (raw - offset) / scale;
    if (!Number.isFinite(result)) {
      output.done();
      return;
    }
    output.sendDone({ out: result });
  });
  return c;
};
