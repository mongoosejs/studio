'use strict';

// env MONGODB\_CONNECTION\_STRING="mongodb://localhost:27017/stratos_local" node ./stratos.js

const db = require('../../BirbAI/backend/db'); // user dependent
const express = require('express');
const studio = require('../express');

run().catch(err => {
  console.error(err);
  process.exit(-1);
});

async function run() {
  const app = express();
  const conn = await db();

  app.use('/studio', studio('/studio/api', conn));

  await app.listen(3002);
  console.log('Listening on port 3002');
}

