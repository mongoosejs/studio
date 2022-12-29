'use strict';

const webpack = require('webpack');

const compiler = webpack(require('./webpack.config'));

compiler.run((err) => {
  if (err) {
    process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
  }
  console.log('Webpack compiled successfully');
});