const noflo = require('noflo');

exports.getComponent = (app) => () => {
  const c = new noflo.Component();
  c.description = 'Get a Signal K path for the vessels.self\'s full data model';
  c.icon = 'indent';
  c.inPorts.add('in', {
    datatype: 'string',
    description: 'Path to fetch',
  });
  c.outPorts.add('out', {
    datatype: 'all',
  });
  c.process((input, output) => {
    const path = input.getData('in');
    output.sendDone({
      out: app.getSelfPath(path),
    });
  });
  return c;
};
