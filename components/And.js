const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Route packet to either pass or fail depending on whether all connected values are true';
  c.icon = 'expand';
  c.inPorts.add('in', {
    datatype: 'all',
  });
  c.inPorts.add('values', {
    datatype: 'boolean',
    addressable: true,
    control: true,
  });
  c.outPorts.add('pass', {
    datatype: 'all',
  });
  c.outPorts.add('fail', {
    datatype: 'all',
  });
  c.forwardBrackets = {
    in: ['pass', 'fail'],
  };
  c.process((input, output) => {
    if (!input.hasData('in')) {
      return;
    }
    const indexesWithData = input.attached('values').filter((idx) => input.hasData(['values', idx]));
    if (indexesWithData.length !== input.attached('values').length) {
      return;
    }
    const value = input.getData('in');
    const values = indexesWithData.map((idx) => input.getData(['values', idx]));
    const containsFalsy = values.findIndex((v) => !v);
    if (containsFalsy !== -1) {
      output.sendDone({
        fail: value,
      });
      return;
    }
    output.sendDone({
      pass: value,
    });
  });
  return c;
};
