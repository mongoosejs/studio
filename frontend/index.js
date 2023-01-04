'use strict';

const webpack = require('webpack');

module.exports = function(apiUrl, isLambda) {
  const config = { ...require('./webpack.config') };
  if (apiUrl != null) {
    config.plugins = [
      new webpack.DefinePlugin({
        config__baseURL: `'${apiUrl}'`,
        config__isLambda: `${!!isLambda}`
      })
    ]
  }
  const compiler = webpack(config);

  return new Promise((resolve, reject) => {
    compiler.run((err) => {
      if (err) {
        reject(err);
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      resolve();
      console.log('Webpack compiled successfully');
    });
  });
};