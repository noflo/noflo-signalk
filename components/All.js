const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Checks values of all connected inputs and sends whether they\'re all truthy or falsy';
  c.icon = 'search';
  c.inPorts.add('in', {
    datatype: 'bang',
  });
  c.inPorts.add('values', {
    datatype: 'boolean',
    addressable: true,
    control: true,
  });
  c.outPorts.add('out', {
    datatype: 'boolean',
  });
  c.process((input, output) => {
    if (!input.hasData('in')) {
      return;
    }
    const indexesWithData = input.attached('values').filter((idx) => input.hasData(['values', idx]));
    if (indexesWithData.length !== input.attached('values').length) {
      return;
    }
    input.getData('in');
    const values = indexesWithData.map((idx) => input.getData(['values', idx]));
    output.sendDone({
      // eslint-disable-next-line eqeqeq
      out: values.every((v) => v != false),
    });
  });
  return c;
};
