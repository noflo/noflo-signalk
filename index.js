const server = require('noflo-nodejs');
const nofloServer = require('noflo-nodejs/src/server');
const fbpGraph = require('fbp-graph');
const { v4: uuidv4 } = require('uuid');
const { readdir, mkdir } = require('node:fs/promises');
const path = require('path');
const componentLoader = require('./componentLoader');

function ensureGraphs(baseDir) {
  const graphDir = path.resolve(baseDir, './graphs');
  return readdir(graphDir)
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return mkdir(graphDir)
          .then(() => []);
      }
      throw err;
    })
    .then((res) => {
      if (!res.length) {
        // No graphs, create a "main"
        const graphPath = path.resolve(graphDir, 'main.json');
        const graph = fbpGraph.graph.createGraph('main');
        graph.setProperties({
          environment: {
            type: 'noflo-nodejs',
          },
        });
        return graph.save(graphPath)
          .then(() => [
            graphPath,
          ]);
      }
      return res.map((r) => path.resolve(graphDir, r));
    });
}

function findMain(graphs) {
  const mainable = graphs.find((g) => g.includes('main'));
  if (mainable) {
    return mainable;
  }
  return graphs[0];
}

module.exports = (app) => {
  let runtime = null;
  let runtimeConfig = null;
  const plugin = {};

  plugin.id = 'noflo-signalk';
  plugin.name = 'NoFlo Signal K';
  plugin.description = 'Signal K automation with the NoFlo visual programming framework';
  let skUuid = app.getSelfPath('uuid');
  if (skUuid) {
    skUuid = skUuid.split(':').pop();
  }

  function preStart(rt, config) {
    runtimeConfig = config;
    // Custom component loading with app context here
    const customLoader = componentLoader(app);
    const loader = rt.component.getLoader(config.baseDir, rt.options);
    return loader.listComponents()
      .then(() => new Promise((resolve, reject) => {
        loader.registerLoader(customLoader, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }));
  }

  plugin.start = (options) => {
    const port = options.port || 3569;
    // FIXME: Determine whether to use HTTPS or HTTP
    const ide = options.ide || 'https://app.flowhub.io';

    // We need to use the .signalk directory as baseDir to be able to load components
    const baseDir = path.resolve(app.getDataDirPath(), '../../');

    const config = {
      id: options.uuid,
      label: `NoFlo on ${app.getSelfPath('name')}`,
      secret: options.secret,
      open: false,
      autoSave: true,
      trace: options.trace,
      protocol: options.protocol || 'websocket',
      catchExceptions: false,
      ide,
      baseDir,
    };
    ensureGraphs(baseDir)
      .then((graphs) => {
        const main = findMain(graphs);
        server(main, config, preStart)
          .then((rt) => {
            runtime = rt;
            app.setPluginStatus(`NoFlo runtime running in port ${port}`);
            // TODO: Start all other graphs as well
          }, (err) => {
            app.debug(err);
            app.setPluginError(`Failed to start NoFlo runtime: ${err.message}`);
          });
      });
  };

  plugin.registerWithRouter = (router) => {
    router.get('/url', (req, res) => {
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
    app.debug('Stopping NoFlo runtime');
    // TODO: Stop running NoFlo networks as well
    nofloServer.stop(runtime)
      .then(() => {
        app.debug('NoFlo runtime stopped');
        runtime = null;
      }, (err) => {
        app.debug('Failed to stop the NoFlo runtime');
        app.debug(err);
      });
  };

  plugin.schema = {
    type: 'object',
    required: [
      'uuid',
      'secret',
    ],
    properties: {
      uuid: {
        title: 'Server instance UUID',
        type: 'string',
        format: 'uuid',
        default: skUuid || uuidv4(),
      },
      secret: {
        title: 'Server instance password',
        type: 'string',
        default: uuidv4(),
      },
      ide: {
        title: 'Flowhub / NoFlo UI instance URL',
        type: 'string',
        format: 'uri',
        default: 'https://app.flowhub.io',
      },
      protocol: {
        title: 'FBP protocol transport to use',
        type: 'string',
        enum: [
          'websocket',
          'webrtc',
        ],
        default: 'websocket',
      },
      port: {
        title: 'FBP Protocol port for the IDE to connect to',
        type: 'number',
        default: 3569,
      },
      trace: {
        title: 'Whether to capture and store a Flowtrace for each graph',
        type: 'boolean',
        default: false,
      },
    },
  };

  return plugin;
};
