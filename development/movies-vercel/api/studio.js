'use strict';

const mongoose = require('mongoose');

require('../movies.model');

const studio = require('../../../backend/next');

const handler = studio(mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  openAIAPIKey: process.env.OPENAI_API_KEY
});

let conn = null;

async function handlerWrapper(req, res) {
  if (conn == null) {
    conn = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, { serverSelectionTimeoutMS: 3000 });
  }

  const params = { ...req.query, ...req.body, ...req.params, authorization: req.headers.authorization };
  console.log('Params', params);

  const result = await handler.apply(null, [req, res]).catch(err => {
    console.log(err);
    throw err;
  });

  console.log('Result', result);
}

module.exports = handlerWrapper;
