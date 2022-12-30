const noflo = require('noflo');

exports.getComponent = (app) => () => {
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
    let initial = app.getSelfPath(path);
    if (typeof initial === 'object' && initial.meta) {
      initial = initial.value;
    }

    // Start with initial value, if available
    output.send({
      out: initial,
    });

    // Then subscribe
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
