'use strict';

const Archetype = require('archetype');
const { Configuration, OpenAIApi } = require('openai');

const apiKey = process.env.OPEN_AI_KEY;

let openai;
if (apiKey) {
  const configuration = new Configuration({
    apiKey
  });
  openai = new OpenAIApi(configuration);
}

const prePrompt = `
You are a software developer answering user queries using Mongoose.
Write Node.js code using Mongoose that answers the user's query.
Do not write any import statements.

Input:
How many users where created yesterday?
Output:
const yesterday = new Date();
yesterday.setHours(0, 0, 0);
yesterday.setDate(yesterday.getDate() - 1);
await User.countDocuments({ createdAt: { $gte: yesterday } });
`.trim();

const CreateChartParams = new Archetype({
  description: {
    $type: 'string',
    $required: true
  }
}).compile('CreateChartParams');

module.exports = ({ db }) => async function createChart(params) {
  const { description } = new CreateChartParams(params);

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: prePrompt
      },
      {
        role: 'user',
        content: description
      }
    ],
    temperature: 0.1
  });

  console.log('F', response.data.choices[0].message.content);

  return {
    content: response.data.choices[0].message.content
  };
};