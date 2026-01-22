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

  console.log('Using Mongoose Studio API Key:', process.env.MONGOOSE_STUDIO_API_KEY);
  console.log('Using OpenAI API Key:', process.env.OPENAI_API_KEY);
  console.log('Handler', handler.toString());

  await handler.apply(null, [req, res]).catch(err => {
    console.log(err);
    throw err;
  });
}

module.exports = handlerWrapper;
