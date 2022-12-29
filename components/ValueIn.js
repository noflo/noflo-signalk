const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Check if value equals one of the given options';
  c.icon = 'check';
  c.inPorts.add('in', {
    datatype: 'all',
  });
  c.inPorts.add('values', {
    datatype: 'string',
    control: true,
  });
  c.outPorts.add('out', {
    datatype: 'boolean',
  });
  c.process((input, output) => {
    if (!input.hasData('in', 'values')) {
      return;
    }
    const [value, values] = input.getData('in', 'values');
    if (values.split(',').includes(value)) {
      output.sendDone({
        out: true,
      });
      return;
    }
    output.sendDone({
      out: false,
    });
  });
  return c;
};
