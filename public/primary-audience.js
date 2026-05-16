function normalizeText(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function toSentence(value = '') {
  const text = normalizeText(value).replace(/[.。]+$/g, '');
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function matchesAny(text, patterns = []) {
  return patterns.some(pattern => pattern.test(text));
}

var LEGACY_AUDIENCE_ALIASES = {
  'Busy professionals who want a clearer, lower-friction start to the day': [
    'Professionals with fragmented mornings who need a concise daily priority briefing'
  ],
  'Busy professionals who want a faster way to stay on top of relevant industry news': [
    'Professionals who need to track specific industry news'
  ],
  'E-commerce sellers and operators who need faster competitor monitoring and pricing visibility': [
    'E-commerce operators who need fast competitor research'
  ],
  'Operators and small teams who want faster follow-up workflows without dropping important conversations': [
    'Operators who need faster follow-up workflows'
  ],
  'Creators and operators who want a simpler way to turn ideas into practical outputs': [
    'Creators who want a simpler production workflow'
  ]
};

var AUDIENCE_RULES = [
  {
    patterns: [/fragmented mornings/, /day ahead/, /4-5 apps/, /calendar, email, slack/, /morning apps/],
    audience: 'Busy professionals who want a clearer, lower-friction start to the day'
  },
  {
    patterns: [/industry news/, /multiple sources/, /daily reading burden/, /analysts?/, /researchers?/, /news digest/, /track specific/],
    audience: 'Busy professionals who want a faster way to stay on top of relevant industry news'
  },
  {
    patterns: [/competitor prices?/, /pricing decisions?/, /amazon/, /e-commerce/, /market research staff/, /price monitoring/, /sku/],
    audience: 'E-commerce sellers and operators who need faster competitor monitoring and pricing visibility'
  },
  {
    patterns: [/follow-?ups?/, /inbound leads?/, /reply/, /sales/, /lead/, /outreach/],
    audience: 'Operators and small teams who want faster follow-up workflows without dropping important conversations'
  },
  {
    patterns: [/creators?/, /content/, /video workflow/, /editing/, /script/, /filming/],
    audience: 'Creators and operators who want a simpler way to turn ideas into practical outputs'
  }
];

function deriveCampaignAudience(useCaseAudience = '') {
  const normalized = normalizeText(useCaseAudience);
  const lower = normalized.toLowerCase();

  if (!lower) return '';

  var matchedRule = AUDIENCE_RULES.find(function(rule) {
    return matchesAny(lower, rule.patterns);
  });
  if (matchedRule) return matchedRule.audience;

  if (matchesAny(lower, [/professionals?/, /founders?/, /managers?/, /operators?/, /teams?/])) {
    return 'Professionals and operators who want a simpler, more efficient workflow for this use case';
  }

  const sentence = normalized.replace(/[.。]+$/g, '');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function buildAudienceSentence(audience = '') {
  return `${String(audience || '').trim().replace(/[.。]+$/g, '')}.`;
}

function listAudienceSuggestionCandidates({ kocAudience = '', useCaseAudience = '' } = {}) {
  const audience = normalizeText(kocAudience);
  const derivedAudience = deriveCampaignAudience(useCaseAudience);
  const baseAudiences = [
    derivedAudience,
    ...(LEGACY_AUDIENCE_ALIASES[derivedAudience] || [])
  ].map(item => normalizeText(item)).filter(Boolean);

  const uniqueAudiences = Array.from(new Set(baseAudiences));
  const candidates = uniqueAudiences.flatMap(function(item) {
    const sentence = buildAudienceSentence(item);
    if (!audience) return [sentence];
    return [
      `${audience} who are especially likely to care about ${toSentence(item)}.`,
      sentence
    ];
  });

  return Array.from(new Set(candidates.flatMap(function(item) {
    const normalized = String(item || '').trim();
    if (!normalized) return [];
    const withoutPunctuation = normalized.replace(/[.。]+$/g, '');
    return withoutPunctuation && withoutPunctuation !== normalized
      ? [normalized, withoutPunctuation]
      : [normalized];
  })));
}

function formatPrimaryAudienceSuggestion({ kocAudience = '', useCaseAudience = '' } = {}) {
  return listAudienceSuggestionCandidates({ kocAudience, useCaseAudience })[0] || '';
}

if (typeof window !== 'undefined') {
  window.deriveCampaignAudience = deriveCampaignAudience;
  window.formatPrimaryAudienceSuggestion = formatPrimaryAudienceSuggestion;
  window.listAudienceSuggestionCandidates = listAudienceSuggestionCandidates;
}
