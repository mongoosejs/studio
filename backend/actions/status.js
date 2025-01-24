'use strict';

const nodeEnv = process.env.NODE_ENV;

module.exports = () => async function status() {
  return { nodeEnv };
};
