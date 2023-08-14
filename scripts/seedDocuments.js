'use strict';

const db = require('../../BirbAI/backend/db'); // user dependent
const mongoose = require('mongoose');

const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => 'oads_live_' + crypto.randomBytes(36).toString('hex')
  },
  publisherId: { 
    type: mongoose.ObjectId,
    required: true
  },
}, { timestamps: true });

async function run() {
  const conn = await db();
  for (let i = 0; i < 200; i++) {
    await conn.models.ApiKey.create({
      publisherId: '63fcdfdf73e72c3b5c1dc9a4'
    });
  }
  console.log('done');
}

run();