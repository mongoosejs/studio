'use strict';

const formatRef = schemaType => (schemaType.options?.ref ? ' (ref: ' + schemaType.options.ref + ')' : '');

const formatNestedSchema = schemaType => {
  const nestedPaths = Object.entries(schemaType.schema.paths).map(
    ([path, nestedSchemaType]) => formatSchemaPath(path, nestedSchemaType)
  );
  return `\n  ${nestedPaths.join('\n  ')}`;
};

const formatSchemaTypeInstance = schemaType => {
  if (schemaType.instance === 'Array') {
    const itemType = schemaType.getEmbeddedSchemaType().instance;
    return itemType === 'DocumentArrayElement' ? 'Subdocument[]' : `${itemType}[]`;
  }
  return schemaType.instance;
};

const formatSchemaPath = (path, schemaType) => `- ${path}: ${formatSchemaTypeInstance(schemaType)}` +
  formatRef(schemaType) +
  (schemaType.schema ? formatNestedSchema(schemaType) : '');

const indentLines = (value, spaces = 2) => value.split('\n').map(line => `${' '.repeat(spaces)}${line}`).join('\n');

const normalizeFunctionSource = fn => {
  const source = fn.toString();
  const lines = source.split('\n');

  if (lines.length <= 1) {
    return source;
  }

  const [firstLine, ...rest] = lines;
  const indentLengths = rest
    .filter(line => line.trim().length > 0)
    .map(line => line.match(/^\s*/)[0].length);
  const minIndent = indentLengths.length > 0 ? Math.min(...indentLengths) : 0;
  const normalizedRest = rest.map(line => line.slice(Math.min(line.length, minIndent)));

  return [firstLine, ...normalizedRest].join('\n');
};

const formatFieldSection = Model => {
  const fieldLines = Object.entries(Model.schema.paths).map(
    ([path, schemaType]) => formatSchemaPath(path, schemaType)
  );
  return fieldLines.length ? ['Fields:', ...fieldLines] : [];
};

const formatVirtualSection = Model => {
  const virtualLines = Object.entries(Model.schema.virtuals).filter(([path, virtual]) => virtual.options?.ref).map(
    ([path, virtual]) => `- ${path}: Virtual (ref: ${virtual.options.ref})`
  );
  return virtualLines.length ? ['Virtuals:', ...virtualLines] : [];
};

const formatMethodSection = Model => {
  const methodEntries = Object.entries(Model.schema.methods || {});
  if (!methodEntries.length) {
    return [];
  }

  return ['Methods:', ...methodEntries.flatMap(([name, fn]) => [`- ${name}:`, indentLines(normalizeFunctionSource(fn), 2)])];
};

const formatStaticSection = Model => {
  const staticEntries = Object.entries(Model.schema.statics || {});
  if (!staticEntries.length) {
    return [];
  }

  return ['Statics:', ...staticEntries.flatMap(([name, fn]) => [`- ${name}:`, indentLines(normalizeFunctionSource(fn), 2)])];
};

const getModelDescriptions = db => Object.values(db.models).filter(Model => !Model.modelName.startsWith('__Studio')).map(Model => {
  const sections = [
    `${Model.modelName} (collection: ${Model.collection.collectionName})`,
    ...formatFieldSection(Model),
    ...formatVirtualSection(Model),
    ...formatMethodSection(Model),
    ...formatStaticSection(Model)
  ];

  return sections.join('\n');
}).join('\n\n');

module.exports = getModelDescriptions;
