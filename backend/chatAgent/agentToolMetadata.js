'use strict';

module.exports = [
  {
    name: 'estimatedDocumentCount',
    description: 'Count the estimated number of documents in a collection. Times out after 5 seconds.'
  },
  {
    name: 'find',
    description: 'Run a find() query on a Mongoose model and return an array of documents. Times out after 5 seconds.'
  },
  {
    name: 'findOne',
    description: 'Run a findOne() query on a Mongoose model and return a single document or null. Times out after 5 seconds.'
  },
  {
    name: 'typeCheck',
    description: 'Type-checks the script and validates syntax using TypeScript and node --check'
  }
];
