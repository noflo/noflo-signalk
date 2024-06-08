const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Checks values of all connected inputs and sends whether they\'re all truthy or falsy';
  c.icon = 'search';
  c.inPorts.add('in', {
    datatype: 'boolean',
    addressable: true,
  });
  c.outPorts.add('out', {
    datatype: 'boolean',
  });
  c.process((input, output) => {
    const indexesWithData = input.attached('in').filter((idx) => input.hasData(['in', idx]));
    if (indexesWithData.length !== input.attached('in').length) {
      return;
    }
    const values = indexesWithData.map((idx) => input.getData(['in', idx]));
    output.sendDone({
      // eslint-disable-next-line eqeqeq
      out: values.every((v) => v != false),
    });
  });
  return c;
};
