const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Invert a boolean value';
  c.icon = 'adjust';
  c.inPorts.add('in', {
    datatype: 'boolean',
  });
  c.outPorts.add('out', {
    datatype: 'boolean',
  });
  c.process((input, output) => {
    const value = input.getData('in');
    if (value) {
      output.sendDone({
        out: false,
      });
      return;
    }
    output.sendDone({
      out: true,
    });
  });
  return c;
};
