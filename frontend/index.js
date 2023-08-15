'use strict';

const webpack = require('webpack');

module.exports = function(apiUrl, isLambda, options) {
  const config = { ...require('./webpack.config') };
  if (apiUrl != null) {
    config.plugins = [
      new webpack.DefinePlugin({
        config__baseURL: `'${apiUrl}'`,
        config__isLambda: `${!!isLambda}`
      })
    ]
  }
  if (options?.setAuthorizationHeaderFrom) {
    config.plugins = config.plugins || [];
    config.plugins.push(new webpack.DefinePlugin({
      config__setAuthorizationHeaderFrom: `'${options.setAuthorizationHeaderFrom}'`
    }));
  }
  const compiler = webpack(config);

  if (options && options.watch) {
    compiler.watch({}, (err) => {
      if (err) {
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      console.log('Webpack compiled successfully');
    });
  } else {
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
  }
};