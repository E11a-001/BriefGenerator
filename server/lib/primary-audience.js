function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function toSentence(value = '') {
  const text = normalizeText(value).replace(/[.。]+$/g, '');
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function formatPrimaryAudienceSuggestion({ kocAudience = '', useCaseAudience = '' } = {}) {
  const audience = normalizeText(kocAudience);
  const useCase = toSentence(useCaseAudience);

  if (!useCase) return '';
  if (!audience) return `${normalizeText(useCaseAudience).replace(/[.。]+$/g, '')}.`;

  if (useCase.startsWith('people') || useCase.startsWith('users') || useCase.startsWith('creators')) {
    return `${audience} who are most likely to care about this use case: ${useCase}.`;
  }

  return `${audience} who are likely to relate to this use case, especially those who are ${useCase}.`;
}
