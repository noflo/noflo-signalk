const noflo = require('noflo');

exports.getComponent = (app) => () => {
  const c = new noflo.Component();
  c.description = 'Send a Signal K PUT request';
  c.icon = 'send';
  c.inPorts.add('path', {
    datatype: 'string',
    control: true,
  });
  c.inPorts.add('value', {
    datatype: 'all',
  });
  c.outPorts.add('out', {
    datatype: 'array',
  });
  c.forwardBrackets = {
    value: ['out'],
  };
  c.process((input, output) => {
    if (!input.hasData('path', 'value')) {
      return;
    }
    const [path, value] = input.getData('path', 'value');
    app.putSelfPath(path, value, (res) => {
      if (res.state === 'COMPLETED') {
        output.sendDone({
          out: res,
        });
      }
    });
  });
  return c;
};
