const noflo = require('noflo');

exports.getComponent = (app) => () => {
  const c = new noflo.Component();
  c.description = 'Get a list of paths currently available in the server';
  c.icon = 'list';
  c.inPorts.add('in', {
    datatype: 'bang',
  });
  c.outPorts.add('out', {
    datatype: 'array',
  });
  c.process((input, output) => {
    input.getData('in');
    output.sendDone({
      out: app.streambundle.getAvailablePaths(),
    });
  });
  return c;
};
