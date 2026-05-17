import { UserFacingError } from './errors.js';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaDescription(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  return '';
}

function shouldUseRenderedExtraction(html, pageText) {
  const scriptMatches = html.match(/<script\b/gi) || [];
  const hasAppShellMarkers =
    /<div[^>]+id=["']root["']/i.test(html) ||
    /<div[^>]+id=["']__next["']/i.test(html) ||
    /<script[^>]+type=["']module["']/i.test(html);
  const textLooksThin = pageText.length < 500;
  const htmlLooksScriptHeavy = scriptMatches.length >= 3;

  return hasAppShellMarkers && (textLooksThin || htmlLooksScriptHeavy);
}

function getHttpStatusMessage(status) {
  if (status === 404) return 'This webpage returned 404 Not Found.';
  if (status === 403) return 'This webpage blocked access with 403 Forbidden.';
  if (status === 401) return 'This webpage requires authentication before it can be read.';
  if (status >= 500) return 'This webpage returned a server error and could not be read.';
  return `This webpage returned HTTP ${status} and could not be read.`;
}

function extractJsonString(content) {
  const normalized = String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .trim();

  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const objectStart = normalized.indexOf('{');
  const objectEnd = normalized.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return normalized.slice(objectStart, objectEnd + 1).trim();
  }

  return normalized;
}

function parseAiJson(data) {
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.choices?.[0]?.messages?.content ||
    data?.output_text ||
    '';

  if (!content) {
    throw new UserFacingError('Failed to generate use case draft.');
  }

  try {
    return JSON.parse(extractJsonString(content));
  } catch {
    throw new UserFacingError('Failed to generate use case draft.');
  }
}

function readAiErrorMessage(data, fallback = 'Failed to generate use case draft.') {
  const directMessage =
    data?.error?.message ||
    data?.message ||
    data?.detail ||
    '';
  const message = String(directMessage || '').trim();
  return message || fallback;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function compactSuggestedElements(items = []) {
  const compacted = [];

  for (const rawItem of items) {
    const item = String(rawItem || '').trim();
    if (!item) continue;

    const shouldMerge =
      compacted.length > 0 &&
      (/^[a-z(]/.test(item) || /^(e\.g\.|i\.e\.)/i.test(item));

    if (shouldMerge) {
      compacted[compacted.length - 1] = `${compacted[compacted.length - 1]}, ${item}`.trim();
      continue;
    }

    compacted.push(item);
  }

  return compacted;
}

function normalizeSuggestedElements(value) {
  if (Array.isArray(value)) {
    return compactSuggestedElements(
      value.map(item => String(item || '').trim()).filter(Boolean)
    );
  }

  const text = String(value || '').trim();
  if (!text) return [];

  const bulletLikeItems = text
    .split(/\r?\n|(?:^|\s)[•▪●-]\s+|\s*;\s+|\s*\|\s*/g)
    .map(item => item.trim())
    .filter(Boolean);

  if (bulletLikeItems.length > 1) {
    return compactSuggestedElements(bulletLikeItems);
  }

  return compactSuggestedElements([text]);
}

function normalizeAiContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next = {
    audienceKeywords: normalizeStringArray(value.audienceKeywords || value.audience_keywords || []),
    problemKeywords: normalizeStringArray(value.problemKeywords || value.problem_keywords || []),
    mustHighlight: normalizeStringArray(value.mustHighlight || value.must_highlight || []),
    mustAvoid: normalizeStringArray(value.mustAvoid || value.must_avoid || [])
  };
  return Object.fromEntries(Object.entries(next).filter(([, items]) => Array.isArray(items) ? items.length : Boolean(items)));
}

function normalizeFieldHints(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next = {
    title: String(value.title || '').trim(),
    description: String(value.description || '').trim(),
    opening_hook: String(value.opening_hook || value.openingHook || '').trim(),
    who_this_is_for: String(value.who_this_is_for || value.whoThisIsFor || '').trim(),
    problem: String(value.problem || '').trim(),
    how_to_show_it: String(value.how_to_show_it || value.howToShowIt || '').trim(),
    expected_outcome: String(value.expected_outcome || value.expectedOutcome || '').trim()
  };
  return Object.fromEntries(Object.entries(next).filter(([, item]) => Boolean(item)));
}

function normalizeReferenceMaterials(materials = []) {
  return (Array.isArray(materials) ? materials : []).map(material => {
    const normalized = {
      type: String(material?.type || '').trim(),
      title: String(material?.title || '').trim(),
      content: String(material?.content || '').trim(),
      url: String(material?.url || '').trim(),
      note: String(material?.note || '').trim()
    };
    if (!normalized.type) {
      if (normalized.url) normalized.type = 'link';
      else if (normalized.content) normalized.type = 'note';
    }
    if (!normalized.type || !(normalized.content || normalized.url || normalized.note)) {
      return null;
    }
    const compact = { type: normalized.type };
    if (normalized.title) compact.title = normalized.title;
    if (normalized.content) compact.content = normalized.content;
    if (normalized.url) compact.url = normalized.url;
    if (normalized.note) compact.note = normalized.note;
    return compact;
  }).filter(Boolean);
}

function buildSeedReferenceMaterials({ url = '', prompt = '', outputText = '', screenshotNote = '' } = {}) {
  const materials = [];
  if (url) {
    materials.push({ type: 'link', title: 'Source URL', url });
  }
  if (prompt) {
    materials.push({ type: 'prompt', title: 'Example prompt', content: prompt });
  }
  if (outputText) {
    materials.push({ type: 'output', title: 'Example output', content: outputText });
  }
  if (screenshotNote) {
    materials.push({ type: 'note', title: 'Screenshot note', content: screenshotNote });
  }
  return materials;
}

function normalizeDraft(input, payload = {}) {
  const url = String(input?.url || '').trim();
  const fieldHints = normalizeFieldHints(input.fieldHints || {});
  const suggestedElements = normalizeSuggestedElements(
    payload.suggested_elements || payload.must_show_elements || payload.mustShowElements || []
  );

  const seedMaterials = buildSeedReferenceMaterials(input);
  const explicitMaterials = normalizeReferenceMaterials(
    payload.reference_materials || payload.referenceMaterials || []
  );
  const referenceMaterials = normalizeReferenceMaterials([
    ...seedMaterials,
    ...explicitMaterials
  ]);

  return {
    title: String(payload.title || '').trim() || fieldHints.title,
    description: String(payload.description || '').trim() || fieldHints.description,
    opening_hook: String(payload.opening_hook || payload.openingHook || '').trim() || fieldHints.opening_hook,
    who_this_is_for: String(payload.who_this_is_for || payload.whoThisIsFor || '').trim() || fieldHints.who_this_is_for,
    problem: String(payload.problem || '').trim() || fieldHints.problem,
    how_to_show_it: String(payload.how_to_show_it || payload.howToShowIt || '').trim() || fieldHints.how_to_show_it,
    expected_outcome: String(payload.expected_outcome || payload.expectedOutcome || '').trim() || fieldHints.expected_outcome,
    must_show_elements: String(payload.must_show_elements || payload.mustShowElements || '').trim(),
    suggested_elements: suggestedElements,
    reference_materials: referenceMaterials,
    ai_context: normalizeAiContext(payload.ai_context || payload.aiContext || input.aiContext || {}),
    links: Array.from(
      new Set([
        url,
        ...(Array.isArray(payload.links) ? payload.links : []),
        ...referenceMaterials.filter(material => material.type === 'link').map(material => material.url)
      ].map(item => String(item || '').trim()).filter(Boolean))
    )
  };
}

async function requestAiDraft({ fetchImpl, apiUrl, apiKey, model, providerName, sourcePayload }) {
  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: [
            'You create reusable creator-brief use case drafts for influencer campaign briefs.',
            'Your job is not to summarize a webpage generally. Your job is to convert webpage content into a practical, reusable use case that a creator can understand and demonstrate in content.',
            'Return JSON only.',
            'Do not use hype, marketing fluff, or unsupported claims.',
            'Focus on benefits and real user outcomes, not feature lists.',
            'Write in clear business English.',
            'Keep each field practical and concrete.',
            '"opening_hook" must be a short, creator-ready opening line idea that targets the audience pain first and creates enough curiosity to earn the next sentence.',
            '"who_this_is_for" must describe the best-fit user situation, not vague demographics.',
            '"how_to_show_it" must describe what a creator should demonstrate on screen.',
            '"opening_hook", "how_to_show_it", and "expected_outcome" must feel connected: the hook promises something the demo can actually show and the outcome can actually deliver.',
            '"must_show_elements" must be specific and visible, not abstract.',
            '"must_show_elements" should stay at the user-experience layer: prompts, inputs, outputs, notifications, before/after comparison, delivery moments, time saved.',
            '"suggested_elements" must be returned as an array of 3-6 creator-facing bullet items.',
            'Do not compress suggested elements into one comma-separated sentence.',
            'If field hints are provided, treat them as high-priority creator-brief guidance.',
            'You may refine, rewrite, or tighten hinted fields so the final copy is clearer and more creator-friendly, but stay aligned with the user intent inside those hints.',
            'Do not ask creators to show source code, function names, backend implementation details, scrape logic, signal-rate math, or internal system metrics unless the page is explicitly for a developer audience.',
            'If the source page is too thin, infer conservatively and do not invent advanced claims.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            ...sourcePayload,
            priorities: [
              'real user value',
              'creator-friendly demonstration',
              'concrete workflow clarity',
              'hook and demo continuity'
            ],
            avoid: [
              'empty marketing phrases',
              'generic product summaries',
              'overly technical language unless clearly required by the page'
            ],
            hard_rules: [
              'Prefer specific business nouns from the source such as product sourcing, pricing strategy, price monitoring, or product selection over generic phrases like repetitive work or workflow automation.',
              'If title or meta description contains a specific use case, preserve that specificity in the output.',
              'When field_hints are present, use them as editorial guidance.',
              'The output should still be a complete, polished draft.',
              'If a hinted field can be made clearer or more creator-friendly without changing its intent, rewrite it.'
            ],
            field_hints: normalizeFieldHints(sourcePayload.field_hints || {}),
            required_schema: {
              title: 'short, reusable, scenario-focused string',
              description: '1-2 concise sentences',
              opening_hook: 'short creator-ready opening line or angle',
              who_this_is_for: 'best-fit user situation string',
              problem: 'workflow pain or friction string',
              how_to_show_it: 'what a creator should demonstrate on screen',
              expected_outcome: 'what the audience should understand after watching',
              must_show_elements: 'concrete required visuals, actions, or proof points',
              suggested_elements: ['string'],
              links: ['string']
            }
          })
        }
      ]
    })
  });

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }

    if (response.status === 429) {
      const message = readAiErrorMessage(
        errorData,
        `AI generation is temporarily unavailable because the configured ${providerName} account hit its usage limit.`
      );
      throw new UserFacingError(`${providerName} rate limit: ${message}`, 429);
    }

    if (response.status === 401 || response.status === 403) {
      const message = readAiErrorMessage(
        errorData,
        `${providerName} authentication failed. Check the configured API key and endpoint.`
      );
      throw new UserFacingError(`${providerName} authentication failed: ${message}`, response.status);
    }

    const message = readAiErrorMessage(errorData);
    throw new UserFacingError(message, response.status || 400);
  }

  const data = await response.json();
  return parseAiJson(data);
}

export function createGenerateUseCaseDraft({
  fetch: fetchImpl = globalThis.fetch,
  apiKey,
  apiUrl = 'https://api.deepseek.com/chat/completions',
  model = 'deepseek-chat',
  providerName = 'DeepSeek',
  renderedExtractor
} = {}) {
  return async function generateUseCaseDraft({ url = '', prompt = '', outputText = '', screenshotNote = '', aiContext = {}, fieldHints = {} }) {
    if (!apiKey || !fetchImpl) {
      throw new UserFacingError('AI generation is not configured.');
    }

    let sourcePayload;

    if (url) {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        throw new UserFacingError(getHttpStatusMessage(response.status));
      }

      const html = await response.text();
      const staticPageText = stripHtml(html).slice(0, 12000);
      const metaDescription = extractMetaDescription(html);
      const pageTitleMatch = html.match(/<title>(.*?)<\/title>/i);
      const staticPageTitle = pageTitleMatch ? pageTitleMatch[1].trim() : '';

      let pageText = staticPageText;
      let pageTitle = staticPageTitle;

      if (renderedExtractor && shouldUseRenderedExtraction(html, staticPageText)) {
        try {
          const rendered = await renderedExtractor({ url });
          if (rendered?.pageText) {
            pageText = String(rendered.pageText).trim().slice(0, 12000);
          }
          if (rendered?.pageTitle) {
            pageTitle = String(rendered.pageTitle).trim();
          }
        } catch {
          pageText = staticPageText;
          pageTitle = staticPageTitle;
        }
      }

      if (!pageText) {
        throw new UserFacingError('Could not extract page content from this link.');
      }

      sourcePayload = {
        task: 'Convert this webpage into a reusable use case draft for a creator brief.',
        source_url: url,
        source_title: pageTitle,
        meta_description: metaDescription,
        source_text: pageText
      };
    } else {
      const manualSource = [
        prompt ? `Prompt:\n${prompt}` : '',
        outputText ? `Output:\n${outputText}` : '',
        screenshotNote ? `Screenshot note:\n${screenshotNote}` : ''
      ].filter(Boolean).join('\n\n').trim();

      if (!manualSource) {
        throw new UserFacingError('Please provide a source URL or prompt/output materials.');
      }

      sourcePayload = {
        task: 'Convert these manually provided materials into a reusable use case draft for a creator brief.',
        source_url: '',
        source_title: 'Manual use case materials',
        meta_description: '',
        source_text: manualSource,
        source_materials: {
          prompt,
          output_text: outputText,
          screenshot_note: screenshotNote
        },
        field_hints: normalizeFieldHints(fieldHints),
        ai_context: {
          audience_keywords: normalizeStringArray(aiContext.audienceKeywords),
          problem_keywords: normalizeStringArray(aiContext.problemKeywords),
          must_highlight: normalizeStringArray(aiContext.mustHighlight),
          must_avoid: normalizeStringArray(aiContext.mustAvoid)
        }
      };
    }

    const draft = await requestAiDraft({
      fetchImpl,
      apiUrl,
      apiKey,
      model,
      providerName,
      sourcePayload
    });

    return normalizeDraft({ url, prompt, outputText, screenshotNote, aiContext, fieldHints }, draft);
  };
}

export { normalizeDraft };
