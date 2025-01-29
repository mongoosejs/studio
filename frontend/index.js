'use strict';

const { execSync, exec } = require('child_process');
const webpack = require('webpack');

module.exports = function(apiUrl, isLambda, options, workspace) {
  const config = { ...require('./webpack.config'), plugins: [] };
  if (apiUrl != null) {
    config.plugins = [
      new webpack.DefinePlugin({
        config__baseURL: `'${apiUrl}'`,
        config__isLambda: `${!!isLambda}`
      })
    ]
  }
  if (options?.setAuthorizationHeaderFrom) {
    config.plugins.push(new webpack.DefinePlugin({
      config__setAuthorizationHeaderFrom: `'${options.setAuthorizationHeaderFrom}'`
    }));
  }
  if (options?.apiKey) {
    config.plugins.push(new webpack.DefinePlugin({
      config__mothershipUrl: `'${options?._mothershipUrl}'` || '\'https://mongoose-js.netlify.app/.netlify/functions\''
    }));
  } else {
    config.plugins.push(new webpack.DefinePlugin({
      config__mothershipUrl: '\'\''
    }));
  }
  config.plugins.push(new webpack.DefinePlugin({
    config__workspaceName: `'${workspace?.name ?? ''}'`
  }));
  const compiler = webpack(config);

  if (options && options.watch) {
    compiler.watch({}, (err) => {
      if (err) {
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      console.log('Webpack compiled successfully');
    });

    const childProcess = exec('npm run tailwind:watch');
    childProcess.stdout.on('data', data => console.log('[TAILWIND]', data));
    childProcess.stderr.on('data', data => console.log('[TAILWIND]', data));
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
