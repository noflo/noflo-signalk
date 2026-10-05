/** @typedef {import("@signalk/server-api").ServerAPI} ServerAPI */
/** @typedef {import("@signalk/server-api").Plugin} Plugin */

const server = require("noflo-nodejs");
const nofloServer = require("noflo-nodejs/src/server");
const fbpGraph = require("fbp-graph");
const { v4: uuidv4 } = require("uuid");
const { readdir, mkdir } = require("node:fs/promises");
const path = require("node:path");
const componentLoader = require("./componentLoader");

const PLUGIN_ID = "noflo-signalk";

function ensureGraphs(baseDir) {
  const graphDir = path.resolve(baseDir, "./graphs");
  return readdir(graphDir)
    .catch((err) => {
      if (err.code === "ENOENT") {
        return mkdir(graphDir).then(() => []);
      }
      throw err;
    })
    .then((res) => {
      if (!res.length) {
        // No graphs, create a "main"
        const graphPath = path.resolve(graphDir, "main.json");
        const graph = fbpGraph.graph.createGraph("main");
        graph.setProperties({
          environment: {
            type: "noflo-nodejs",
          },
        });
        return graph.save(graphPath).then(() => [graphPath]);
      }
      return res.map((r) => path.resolve(graphDir, r));
    });
}

function findMain(graphs) {
  const mainable = graphs.find((g) => g.includes("main"));
  if (mainable) {
    return mainable;
  }
  return graphs[0];
}

// NoFlo may reject with values that are not Error instances
function errorMessage(err) {
  if (!err) {
    return "unknown error";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err.message || err);
}

function graphName(graphPath) {
  return path.basename(graphPath, path.extname(graphPath));
}

/**
 * NoFlo runtime plugin for Signal K.
 *
 * Runs a noflo-nodejs runtime serving the graphs in the Signal K data
 * directory, so they can be edited in the NoFlo UI and execute Signal K
 * automation. The main graph starts with the plugin; component loading
 * gets the Signal K app context via a custom loader.
 *
 * @param {ServerAPI} app - Signal K server API
 * @returns {Plugin}
 */
module.exports = (app) => {
  let runtime = null;
  let runtimeConfig = null;
  const plugin = {};

  // Compatibility with servers that only provide the provider-level status API
  const setStatus = (app.setPluginStatus || app.setProviderStatus)?.bind(app);
  const setError = (app.setPluginError || app.setProviderError)?.bind(app);

  plugin.id = PLUGIN_ID;
  plugin.name = "NoFlo Signal K";
  plugin.description =
    "Signal K automation with the NoFlo visual programming framework";
  let skUuid = app.getSelfPath("uuid");
  if (skUuid) {
    skUuid = skUuid.split(":").pop();
  }

  function preStart(rt, config) {
    runtimeConfig = config;
    // Custom component loading with app context here
    const customLoader = componentLoader(app);
    const loader = rt.component.getLoader(config.baseDir, rt.options);
    return loader.listComponents().then(
      () =>
        new Promise((resolve, reject) => {
          loader.registerLoader(customLoader, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),
    );
  }

  plugin.start = (options) => {
    const port = typeof options.port === "number" ? options.port : 3569;
    // FIXME: Determine whether to use HTTPS or HTTP
    const ide = options.ide || "https://app.noflojs.org";

    // We need to use the .signalk directory as baseDir to be able to load components
    const baseDir = path.resolve(app.getDataDirPath(), "../../");

    const config = {
      id: options.uuid,
      label: `NoFlo on ${app.getSelfPath("name")}`,
      secret: options.secret,
      open: false,
      autoSave: true,
      trace: options.trace,
      protocol: options.protocol || "websocket",
      catchExceptions: true,
      ide,
      baseDir,
      port,
    };
    // Report startup progress immediately so Signal K doesn't show the
    // default "Started" state while the async runtime boot is still running
    setStatus("Starting NoFlo runtime");

    return ensureGraphs(baseDir).then(
      (graphs) => {
        const main = findMain(graphs);
        const mainGraphName = graphName(main);
        setStatus(`Starting main graph ${mainGraphName}`);
        return server(main, config, preStart).then(
          (rt) => {
            runtime = rt;
            const boundPort = rt.webServer.address().port;
            setStatus(`NoFlo runtime running in port ${boundPort}`);
            // TODO: Start all other graphs as well
          },
          (err) => {
            app.error(
              `Failed to start main graph ${mainGraphName}: ${errorMessage(err)}`,
            );
            app.debug(err);
            setError(
              `Failed to start main graph ${mainGraphName}: ${errorMessage(err)}`,
            );
          },
        );
      },
      (err) => {
        app.error(`Failed to prepare NoFlo graphs: ${errorMessage(err)}`);
        app.debug(err);
        setError(`Failed to prepare NoFlo graphs: ${errorMessage(err)}`);
      },
    );
  };

  plugin.registerWithRouter = (router) => {
    router.get("/url", (_req, res) => {
      if (!runtime) {
        res.sendStatus(404);
        return;
      }
      // FIXME: We need options here
      res.send(nofloServer.liveUrl(runtimeConfig));
    });
  };

  plugin.stop = () => {
    if (!runtime) {
      return;
    }
    app.debug("Stopping NoFlo runtime");
    // TODO: Stop running NoFlo networks as well
    nofloServer.stop(runtime).then(
      () => {
        app.debug("NoFlo runtime stopped");
        runtime = null;
        setStatus("NoFlo stopped");
      },
      (err) => {
        app.error("Failed to stop the NoFlo runtime");
        app.error(err);
      },
    );
  };

  plugin.schema = {
    type: "object",
    required: ["uuid", "secret"],
    properties: {
      uuid: {
        title: "Server instance UUID",
        description: "Unique ID for this installation's NoFlo runtime",
        type: "string",
        format: "uuid",
        default: skUuid || uuidv4(),
      },
      secret: {
        title: "Server instance password",
        description: "Password the NoFlo UI uses to connect to the runtime",
        type: "string",
        default: uuidv4(),
      },
      ide: {
        title: "NoFlo UI instance URL",
        description: "URL of the NoFlo UI to launch for editing graphs",
        type: "string",
        format: "uri",
        default: "https://app.noflojs.org",
      },
      protocol: {
        title: "FBP protocol transport to use",
        description: "Transport the NoFlo UI uses to talk to the runtime",
        type: "string",
        enum: ["websocket", "webrtc"],
        default: "websocket",
      },
      port: {
        title: "FBP Protocol port for the IDE to connect to",
        description:
          "TCP port the NoFlo runtime listens on for the UI connection",
        type: "number",
        default: 3569,
      },
      trace: {
        title: "Whether to capture and store a Flowtrace for each graph",
        description:
          "Captured traces can be inspected later to debug graph behavior",
        type: "boolean",
        default: false,
      },
    },
  };

  return plugin;
};
