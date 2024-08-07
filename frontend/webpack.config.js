'use strict';

const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: {
    app: `${__dirname}/src/index.js`
  },
  target: 'web',
  devtool: false,
  optimization: {
    minimize: false
  },
  output: {
    path: `${__dirname}/public`,
    filename: '[name].js'
  },
  plugins: [
    new webpack.DefinePlugin({
      config__baseURL: '\'/.netlify/functions/admin\''
    })
  ],
  module: {
    rules: [
      {
        test: /\.html$/i,
        type: 'asset/source'
      },
      {
        test: /\.css$/i,
        type: 'asset/source'
      }
    ]
  }
};
