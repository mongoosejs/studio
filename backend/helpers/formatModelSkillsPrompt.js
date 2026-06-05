'use strict';

module.exports = function formatModelSkillsPrompt(modelSkills) {
  const entries = Object.entries(modelSkills).filter(([, skills]) => typeof skills === 'string' && skills.trim());
  if (entries.length === 0) {
    return null;
  }

  return [
    'The user has defined the following model-specific skills. You MUST follow these instructions when identifying, querying, or writing scripts for each model.',
    ...entries.map(([modelName, skills]) => `### ${modelName}\n${skills.trim()}`)
  ].join('\n\n');
};
