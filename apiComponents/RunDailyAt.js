const noflo = require("noflo");

/** Accepted format for the `time` port values, 24h HH:MM */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DATETIME_PATH = "navigation.datetime";
const TIMEZONE_PATH = "environment.time.timezoneOffset";

/**
 * Signal K path getters return the full leaf object ({ value, timestamp,
 * $source, ... }) on some server versions and the plain value on others.
 *
 * @param {*} pathValue - Value as returned by getSelfPath or the stream
 * @returns {*} The plain value
 */
function leafValue(pathValue) {
  if (pathValue && typeof pathValue === "object" && "value" in pathValue) {
    return pathValue.value;
  }
  return pathValue;
}

/**
 * Convert a (-)hhmm timezone offset to minutes.
 *
 * @param {number} hhmm - Offset in (-)hhmm encoding, e.g. 200 or -930
 * @returns {number} Offset from UTC in minutes
 */
function offsetToMinutes(hhmm) {
  const offset = Number(hhmm) || 0;
  const sign = offset < 0 ? -1 : 1;
  const abs = Math.abs(offset);
  return sign * (Math.floor(abs / 100) * 60 + (abs % 100));
}

/**
 * Time of day of a timezone-shifted timestamp, as HH:MM.
 *
 * The timezone shift is applied to the epoch value, so the UTC getters
 * return the onboard local wall-clock time.
 *
 * @param {Date} shifted - Datetime shifted by the timezone offset
 * @returns {string} Time of day as HH:MM
 */
function timeOfDay(shifted) {
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Generator component that fires `out` once per local day when the
 * onboard time reaches one of the configured times of day.
 *
 * Configure it with an IIP on `time`: a single HH:MM string or an array
 * of them. Receiving the configuration starts the component; it keeps
 * running and evaluates on every `navigation.datetime` or
 * `environment.time.timezoneOffset` update.
 *
 * Unlike the components this replaces in graphs, the datetime and
 * timezone are fetched inside the component: it reads the initial
 * values with app.getSelfPath and subscribes to the Signal K
 * streambundle for updates.
 *
 * Onboard local time is computed as UTC + the timezone offset.
 * Evaluation only starts once a timezone offset has been received:
 * evaluating in UTC before the offset is known could misfire the daily
 * catch-up when the network starts.
 *
 * Each configured time fires at most once per local calendar day: the
 * first datetime update at or after the configured local time sends the
 * trigger. This also acts as catch-up when the network starts after a
 * configured time has already passed.
 *
 * @param {import("@signalk/server-api").ServerAPI} app - Signal K server API
 * @returns {() => noflo.Component} NoFlo component factory
 */
exports.getComponent = (app) => () => {
  const c = new noflo.Component();
  c.description =
    "Fires out once per local day when the onboard time reaches one of " +
    "the configured times. Subscribes to navigation.datetime and " +
    "environment.time.timezoneOffset itself";
  c.icon = "clock-o";

  c.inPorts.add("time", {
    datatype: "all",
    description:
      "Local time of day to fire at as HH:MM, or an array of " +
      "times. Receiving this starts the component",
    required: true,
  });
  c.outPorts.add("out", {
    datatype: "bang",
    description:
      "Daily trigger, sent when local time reaches a " + "configured time",
  });
  c.outPorts.add("error", {
    datatype: "object",
  });

  // No brackets to forward: the component runs indefinitely
  c.forwardBrackets = {};

  /** Local date (YYYY-MM-DD) each configured time last fired on */
  const lastFired = new Map();
  /** Unsubscribers for the Signal K streams */
  let unsubscribes = [];
  /** Latest known datetime and timezone offset values */
  let datetime = null;
  let timezone = null;
  /** Configured times of day, HH:MM */
  let times = [];
  /** Generator context kept alive while the component runs */
  let activeContext = null;

  function stopStreams() {
    unsubscribes.forEach((unsub) => {
      unsub();
    });
    unsubscribes = [];
    if (activeContext) {
      activeContext.deactivate();
      activeContext = null;
    }
  }

  function sendError(err) {
    c.outPorts.error.sendIP(new noflo.IP("data", err));
  }

  /**
   * Evaluates whether any configured time has been reached on the
   * current onboard local wall clock, firing once per time per day.
   */
  function evaluate() {
    if (datetime == null || timezone == null) {
      return;
    }
    const value = leafValue(datetime);
    const utc = new Date(value);
    if (Number.isNaN(utc.getTime())) {
      // Report once, then wait for the next datetime update
      datetime = null;
      sendError(new Error(`Invalid datetime received: ${value}`));
      return;
    }

    // Onboard local wall-clock = UTC + timezone offset
    const local = new Date(
      utc.getTime() + offsetToMinutes(timezone) * 60 * 1000,
    );
    const today = local.toISOString().slice(0, 10);
    const localTime = timeOfDay(local);
    for (const time of times) {
      if (lastFired.get(time) === today) {
        continue;
      }
      if (localTime < time) {
        continue;
      }
      lastFired.set(time, today);
      c.outPorts.out.sendIP(new noflo.IP("data", true));
    }
  }

  /**
   * Reads the current datetime and timezone offset and subscribes to
   * their updates on the Signal K streambundle.
   */
  function subscribe() {
    datetime = app.getSelfPath(DATETIME_PATH);
    timezone = app.getSelfPath(TIMEZONE_PATH);
    unsubscribes = [
      app.streambundle.getSelfStream(DATETIME_PATH).forEach((value) => {
        datetime = value;
        evaluate();
      }),
      app.streambundle.getSelfStream(TIMEZONE_PATH).forEach((value) => {
        timezone = value;
        evaluate();
      }),
    ];
  }

  c.tearDown = (callback) => {
    stopStreams();
    lastFired.clear();
    callback();
  };

  c.process((input, output, context) => {
    if (!input.hasData("time")) {
      return;
    }
    const configured = input.getData("time");
    const list = (Array.isArray(configured) ? configured : [configured]).map(
      String,
    );
    const invalid = list.find((time) => !TIME_PATTERN.test(time));
    if (list.length === 0 || invalid != null) {
      output.sendDone({
        error: new Error(
          `Invalid time configuration, expected HH:MM: ${invalid ?? configured}`,
        ),
      });
      return;
    }

    times = list;
    // Restart with the new configuration, keeping the firing history so
    // unchanged times don't refire on the same local day
    stopStreams();
    activeContext = context;
    subscribe();
    evaluate();
  });

  return c;
};
