const CLASS_LEVELS = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];
const ARMS = ['A', 'B', 'C', 'D', 'E', 'F'];

function classLevelsForSubject(subjectTier) {
  if (subjectTier === 'JSS') return CLASS_LEVELS.filter((l) => l.startsWith('JSS'));
  if (subjectTier === 'SSS') return CLASS_LEVELS.filter((l) => l.startsWith('SSS'));
  return CLASS_LEVELS;
}

module.exports = { CLASS_LEVELS, ARMS, classLevelsForSubject };
