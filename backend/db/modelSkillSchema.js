'use strict';

const mongoose = require('mongoose');

const modelSkillSchema = new mongoose.Schema({
  modelName: {
    type: String,
    required: true,
    unique: true
  },
  skills: {
    type: String,
    default: ''
  }
});

module.exports = modelSkillSchema;
