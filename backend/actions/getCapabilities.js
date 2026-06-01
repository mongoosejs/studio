'use strict';

module.exports = ({ db, options }) => async function getCapabilities() {
  const connection = db?.connection ?? db;
  const admin = typeof connection?.db?.admin === 'function' ? connection.db.admin() : null;
  const supportsAI = hasAIProviderKey(options);

  if (admin == null || typeof admin.command !== 'function') {
    return {
      supportsChangeStreams: false,
      supportsTransactions: false,
      supportsAI
    };
  }

  let hello;
  try {
    hello = await admin.command({ hello: 1 });
  } catch (err) {
    hello = await admin.command({ isMaster: 1 });
  }

  const maxWireVersion = hello?.maxWireVersion ?? 0;
  const supportsModernMongoFeatures = maxWireVersion >= 7;
  const isReplicaSet = !!hello?.setName;
  const isMongos = hello?.msg === 'isdbgrid';
  const hasSessions = hello?.logicalSessionTimeoutMinutes != null;

  return {
    supportsChangeStreams: supportsModernMongoFeatures && (isReplicaSet || isMongos),
    supportsTransactions: supportsModernMongoFeatures && hasSessions && (isReplicaSet || isMongos),
    supportsAI
  };
};

function hasAIProviderKey(options) {
  return [
    options?.openAIAPIKey,
    options?.anthropicAPIKey,
    options?.googleGeminiAPIKey
  ].some(value => typeof value === 'string' ? value.trim().length > 0 : !!value);
}
