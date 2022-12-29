const noflo = require('noflo');

exports.getComponent = () => {
  const c = new noflo.Component();
  c.description = 'Pass a value only when it changes';
  c.icon = 'filter';
  c.inPorts.add('in', {
    datatype: 'all',
  });
  c.outPorts.add('out', {
    datatype: 'all',
  });
  let previousValue;
  let hasReceived = false;
  c.tearDown = (callback) => {
    previousValue = null;
    hasReceived = false;
    callback();
  };
  c.process((input, output) => {
    const value = input.getData('in');
    if (!hasReceived) {
      // First packet, don't trigger
      previousValue = value;
      hasReceived = true;
      output.done();
      return;
    }
    if (value === previousValue) {
      output.done();
      return;
    }
    previousValue = value;
    output.sendDone({
      out: value,
    });
  });
  return c;
};
