'use strict';

const vm = require('vm');
const ts = require('typescript');
const { tool } = require('ai');
const { jsonSchema } = require('@ai-sdk/provider-utils');
const agentToolMetadata = require('./agentToolMetadata');

module.exports = function getAgentTools(db) {
  const modelNames = Object.keys(db.models).filter(name => !name.startsWith('__Studio'));
  const toolDescriptions = Object.fromEntries(agentToolMetadata.map(tool => [tool.name, tool.description]));

  return {
    estimatedDocumentCount: tool({
      description: toolDescriptions.estimatedDocumentCount + ' Takes a model name.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          modelName: { type: 'string', description: 'The Mongoose model name' }
        },
        required: ['modelName']
      }),
      execute: async({ modelName }) => {
        console.log(`estimatedDocumentCount: modelName=${modelName}`);
        const Model = db.models[modelName];
        if (Model == null) {
          return { error: `Model ${modelName} not found. Available models: ${modelNames.join(', ')}` };
        }
        const count = await Model.estimatedDocumentCount().maxTimeMS(5000);
        return { modelName, count };
      }
    }),
    find: tool({
      description: toolDescriptions.find,
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          modelName: { type: 'string', description: 'The Mongoose model name' },
          filter: { type: 'object', description: 'MongoDB query filter', default: {} },
          limit: { type: 'number', description: 'Maximum number of documents to return', default: 10 }
        },
        required: ['modelName']
      }),
      execute: async({ modelName, filter = {}, limit = 10 }) => {
        console.log(`find: modelName=${modelName}, filter=${JSON.stringify(filter)}, limit=${limit}`);
        const Model = db.models[modelName];
        if (Model == null) {
          return { error: `Model ${modelName} not found. Available models: ${modelNames.join(', ')}` };
        }
        const docs = await Model.find(filter).limit(limit).maxTimeMS(5000);
        return { modelName, count: docs.length, docs };
      }
    }),
    findOne: tool({
      description: toolDescriptions.findOne,
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          modelName: { type: 'string', description: 'The Mongoose model name' },
          filter: { type: 'object', description: 'MongoDB query filter', default: {} }
        },
        required: ['modelName']
      }),
      execute: async({ modelName, filter = {} }) => {
        console.log(`findOne: modelName=${modelName}, filter=${JSON.stringify(filter)}`);
        const Model = db.models[modelName];
        if (Model == null) {
          return { error: `Model ${modelName} not found. Available models: ${modelNames.join(', ')}` };
        }
        const doc = await Model.findOne(filter).maxTimeMS(5000);
        return { modelName, doc };
      }
    }),
    typeCheck: tool({
      description: toolDescriptions.typeCheck + ' The script will run in a sandbox with globals: db (mongoose.Connection), mongoose, ObjectId (mongoose.Types.ObjectId), console, and MongooseStudioChartColors (string[]). Pass the raw script body (no imports, no wrapping function). Returns any TypeScript errors or JavaScript syntax errors found. Remember that you should write JavaScript, NOT TypeScript. This tool is just to check for obvious errors.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          script: { type: 'string', description: 'The script to type-check' }
        },
        required: ['script']
      }),
      execute: async({ script }) => {
        const wrapped = wrapScriptForTypeCheck(script);
        const fileName = '__check.ts';
        const compilerOptions = {
          noEmit: true,
          strict: false,
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Node10,
          esModuleInterop: true,
          baseUrl: require('path').resolve(__dirname, '..', '..'),
          paths: { mongoose: ['./node_modules/mongoose'] }
        };
        const host = ts.createCompilerHost(compilerOptions);
        const originalGetSourceFile = host.getSourceFile;
        host.getSourceFile = (name, languageVersion) => {
          if (name === fileName) {
            return ts.createSourceFile(name, wrapped, languageVersion);
          }
          return originalGetSourceFile.call(host, name, languageVersion);
        };
        const program = ts.createProgram([fileName], compilerOptions, host);
        const diagnostics = ts.getPreEmitDiagnostics(program)
          .filter(d => d.file?.fileName === fileName);

        const errors = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));

        // Also check that the script is valid JavaScript (not TypeScript) via vm.Script
        try {
          new vm.Script('(async () => {\n' + script + '\n})()');
        } catch (e) {
          errors.push('JavaScript syntax error: ' + e.message);
        }

        if (errors.length === 0) {
          return { ok: true };
        }

        console.log('Errors', errors);

        return { ok: false, errors };
      }
    })
  };
};

const wrapScriptForTypeCheck = (script) => `
import mongoose from 'mongoose';
declare const db: Omit<mongoose.Connection, 'model'> & {
  model(name: string): mongoose.Model<any>;
};
declare const ObjectId: typeof mongoose.Types.ObjectId;
declare const console: Console;
declare const MongooseStudioChartColors: string[];
async function __script() {
${script}
}
`;
