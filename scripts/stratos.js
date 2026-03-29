'use strict';

// env MONGODB\_CONNECTION\_STRING="mongodb://localhost:27017/stratos_local" node ./stratos.js

const db = require('../../stratos-ai/backend/db'); // user dependent
const express = require('express');
const studio = require('../express');
const dashboardSchema = require('../backend/db/dashboardSchema');
const http = require('http');

run().catch(err => {
  console.error(err);
  process.exit(-1);
});

async function run() {
  const app = express();
  const conn = await db();
  // app.use('/studio', await studio(
  //   null,
  //   conn,
  //   {
  //     __build: true,
  //     __watch: process.env.WATCH
  //   })
  // );

  //   app.use('/studio', await studio('/studio/api', conn,   {
  //   __build: true,
  //   watch: process.env.WATCH,
  //   _mothershipUrl: 'https://mongoose-js.netlify.app/.netlify/functions', //'http://localhost:8888/.netlify/functions',
  //   apiKey: 'H1l3F7sTSn5ueobsxOezIIlCgzcel83Za3EzTtpQbQXjZ4h5ANa9oM1DPrrquPv+kLfRqCCXqxXEYOSp',
  //  enableTaskVisualizer: false
  // }));

    app.use('/studio', await studio('/studio/api', conn,   {
    __build: true,
    watch: process.env.WATCH,
    _mothershipUrl: 'http://localhost:7777/.netlify/functions',
   apiKey: 'H1l3F7sTSn5ueobsxOezIIlCgzcel83Za3EzTtpQbQXjZ4h5ANa9oM1DPrrquPv+kLfRqCCXqxXEYOSp',
   enableTaskVisualizer: false
  }));

  await app.listen(3002);
  console.log('Listening on port 3002');
}

function pingLocalhost() {
  const options = {
    hostname: 'localhost',
    port: 7777,
    path: '/.netlify/functions/status',
    method: 'GET',
    timeout: 10000
  };

  const req = http.request(options, (res) => {
    console.log(`Ping to localhost:7777 - Status: ${res.statusCode}`);
    res.on('data', () => {});
    res.on('end', () => {});
  });

  req.on('error', (err) => {
    console.error(err);
    console.error(`Error pinging localhost:7777: ${err.message}`);
  });

  req.on('timeout', () => {
    console.error('Ping to localhost:7777 timed out');
    req.destroy();
  });

  req.end();
}

