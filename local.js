'use strict';

const mongoose = require('mongoose');
const connect = require('./seed/connect');

const express = require('express');
const studio = require('./express');

const getModelDescriptions = require('./backend/helpers/getModelDescriptions');

Error.stackTraceLimit = 25;

run().catch(err => {
  console.error(err);
  process.exit(-1);
});

async function run() {
  const app = express();
  await connect();

  console.log(getModelDescriptions(mongoose.connection));

  app.use('/studio', await studio(
    null,
    null,
    {
      __build: true,
      __watch: process.env.WATCH,
      _mothershipUrl: 'http://localhost:7777/.netlify/functions',
      //apiKey: 'TACO',
      openAIAPIKey: process.env.OPENAI_API_KEY,
      googleGeminiAPIKey: process.env.GEMINI_API_KEY
    })
  );

  await app.listen(3333);
  console.log('Listening on port 3333');
}
