const noflo = require('noflo');

exports.getComponent = (app) => {
  return () => {
    const c = new noflo.Component();
    c.description = 'Listen for new values in a given Signal K path';
    c.icon = 'inbox';
    c.inPorts.add('in', {
      datatype: 'string',
      description: 'Path to listen to',
    });
    c.outPorts.add('out', {
      datatype: 'all',
    });
    let unsubscribes = [];
    c.tearDown = (callback) => {
      unsubscribes.forEach((unsub) => {
        unsub.unsub();
        unsub.context.deactivate();
      });
      unsubscribes = [];
      callback();
    };
    c.process((input, output, context) => {
      const path = input.getData('in');
      const unsub = app.streambundle
        .getSelfStream(path)
        .forEach((val) => {
          output.send({
            out: val,
          });
        });
      unsubscribes.push({
        context,
        unsub,
      });
    });
    return c;
  };
};
