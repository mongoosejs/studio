'use strict';

const mongoose = require('mongoose');

require('../movies.model');

const studio = require('../../../backend/next');

const handler = studio(mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  mcp: false,
  googleGeminiAPIKey: process.env.GOOGLE_GEMINI_API_KEY
});

let conn = null;

async function handlerWrapper(req, res) {
  if (conn == null) {
    conn = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, { serverSelectionTimeoutMS: 3000 });
  }

  return handler(req, res);
}

module.exports = handlerWrapper;
