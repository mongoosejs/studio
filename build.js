'use strict';

const webpack = require('webpack');
const webpackConfig = require('./frontend/webpack.config');

(async function () {
  const compiler = webpack(webpackConfig);
  await new Promise((resolve, reject) => {
    compiler.run((err) => {
      if (err) {
        reject(err);
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      resolve();
      console.log('Webpack compiled successfully');
    });
  });
})();
