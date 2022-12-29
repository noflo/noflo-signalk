const { readdir } = require('fs');
const path = require('path');

// We need a custom loader to access the app context
module.exports = (app) => {
  const componentDir = path.resolve(__dirname, 'apiComponents');
  return (loader, callback) => {
    readdir(componentDir, (err, res) => {
      if (err) {
        callback(err);
        return;
      }
      res.forEach((component) => {
        // eslint-disable-next-line global-require,import/no-dynamic-require
        const instance = require(path.resolve(componentDir, component));
        const name = path.basename(component, path.extname(component));
        loader.registerComponent('signalk', name, instance.getComponent(app));
      });
      callback();
    });
  };
};
