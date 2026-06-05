'use strict';

module.exports = async function getModelSkillsMap(studioConnection) {
  const ModelSkill = studioConnection?.models?.['__Studio_ModelSkill'];
  if (ModelSkill == null) {
    return {};
  }

  const docs = await ModelSkill.find({ skills: { $exists: true, $nin: [null, ''] } }).lean();
  return Object.fromEntries(docs.map(doc => [doc.modelName, doc.skills]));
};
