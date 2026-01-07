'use strict';

module.exports = function getRefFromSchemaType(schemaType) {
  return schemaType?.options?.ref ?? schemaType?.embeddedSchemaType?.options?.ref ?? schemaType?.caster?.options?.ref;
};
