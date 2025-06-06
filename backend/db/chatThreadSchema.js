'use strict';

const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema({
  title: {
    type: String
  },
  userId: {
    type: mongoose.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = chatThreadSchema;
