import crypto from 'node:crypto';
import { Router } from 'express';
import { UserFacingError } from '../lib/errors.js';

function isPrivateUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    // Strip brackets for IPv6
    const bare = hostname.replace(/^\[|\]$/g, '');
    // IPv4 private ranges
    if (/^127\./.test(bare)) return true;
    if (/^10\./.test(bare)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(bare)) return true;
    if (/^192\.168\./.test(bare)) return true;
    if (/^169\.254\./.test(bare)) return true;
    if (bare === '0.0.0.0') return true;
    return false;
  } catch {
    return true;
  }
}

export function createUseCaseRoutes(db, deps = {}) {
  const router = Router();
  const generateUseCaseDraft = deps.generateUseCaseDraft;

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

  function normalizeBulletText(value) {
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

  function normalizeAiContext(body = {}) {
    const source = body.aiContext || body.ai_context || {};
    const next = {
      audienceKeywords: normalizeStringArray(source.audienceKeywords || source.audience_keywords || body.audienceKeywords || body.audience_keywords),
      problemKeywords: normalizeStringArray(source.problemKeywords || source.problem_keywords || body.problemKeywords || body.problem_keywords),
      mustHighlight: normalizeStringArray(source.mustHighlight || source.must_highlight || body.mustHighlight || body.must_highlight),
      mustAvoid: normalizeStringArray(source.mustAvoid || source.must_avoid || body.mustAvoid || body.must_avoid)
    };
    return Object.fromEntries(Object.entries(next).filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value)));
  }

  function normalizeFieldHints(body = {}) {
    const source = body.fieldHints || body.field_hints || {};
    const next = {
      title: String(source.title || body.title || '').trim(),
      description: String(source.description || body.description || '').trim(),
      opening_hook: String(source.opening_hook || source.openingHook || body.opening_hook || body.openingHook || '').trim(),
      who_this_is_for: String(source.who_this_is_for || source.whoThisIsFor || body.who_this_is_for || body.whoThisIsFor || '').trim(),
      problem: String(source.problem || body.problem || '').trim(),
      how_to_show_it: String(source.how_to_show_it || source.howToShowIt || body.how_to_show_it || body.howToShowIt || '').trim(),
      expected_outcome: String(source.expected_outcome || source.expectedOutcome || body.expected_outcome || body.expectedOutcome || '').trim()
    };
    return Object.fromEntries(Object.entries(next).filter(([, value]) => Boolean(value)));
  }

  function normalizeReferenceMaterials(body = {}) {
    const source = Array.isArray(body.referenceMaterials)
      ? body.referenceMaterials
      : Array.isArray(body.reference_materials)
        ? body.reference_materials
        : [];

    const explicitMaterials = source.map(material => {
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

    if (!explicitMaterials.length) {
      const legacyLinks = Array.isArray(body.links) ? body.links : [];
      legacyLinks.forEach(link => {
        const normalizedLink = String(link || '').trim();
        if (!normalizedLink) return;
        if (explicitMaterials.some(material => material.type === 'link' && material.url === normalizedLink)) return;
        explicitMaterials.push({
          type: 'link',
          url: normalizedLink
        });
      });
    }

    return explicitMaterials;
  }

  function extractLegacyLinks(referenceMaterials = []) {
    return referenceMaterials
      .filter(material => material.type === 'link' && material.url)
      .map(material => material.url);
  }

  function normalizeLegacyLinks(body = {}, referenceMaterials = []) {
    const links = Array.isArray(body.links) ? body.links : [];
    return Array.from(new Set([
      ...links.map(link => String(link || '').trim()).filter(Boolean),
      ...extractLegacyLinks(referenceMaterials)
    ]));
  }

  function normalizeSuggestedElements(body = {}) {
    if (Array.isArray(body.suggestedElements)) {
      return compactSuggestedElements(body.suggestedElements.map(item => String(item || '').trim()).filter(Boolean));
    }
    if (Array.isArray(body.suggested_elements)) {
      return compactSuggestedElements(body.suggested_elements.map(item => String(item || '').trim()).filter(Boolean));
    }
    return normalizeBulletText(body.mustShowElements || body.must_show_elements || '');
  }

  function serializeSuggestedElements(items = []) {
    return items.join(', ');
  }

  function normalizeDraftResponse(draft = {}, fieldHints = {}) {
    const normalizedHints = normalizeFieldHints(fieldHints);
    const suggestedElements = normalizeSuggestedElements(draft);
    const baseReferenceMaterials = normalizeReferenceMaterials(draft);
    const existingLinks = new Set(extractLegacyLinks(baseReferenceMaterials));
    const additionalLinkMaterials = normalizeLegacyLinks(draft, baseReferenceMaterials)
      .filter(link => !existingLinks.has(link))
      .map(link => ({
        type: 'link',
        title: 'Reference link',
        url: link
      }));
    const referenceMaterials = normalizeReferenceMaterials({
      referenceMaterials: [...baseReferenceMaterials, ...additionalLinkMaterials]
    });
    return {
      ...draft,
      title: draft.title || normalizedHints.title || '',
      description: draft.description || normalizedHints.description || '',
      opening_hook: draft.opening_hook || draft.openingHook || normalizedHints.opening_hook || '',
      who_this_is_for: draft.who_this_is_for || draft.whoThisIsFor || normalizedHints.who_this_is_for || '',
      problem: draft.problem || normalizedHints.problem || '',
      how_to_show_it: draft.how_to_show_it || draft.howToShowIt || normalizedHints.how_to_show_it || '',
      expected_outcome: draft.expected_outcome || draft.expectedOutcome || normalizedHints.expected_outcome || '',
      suggested_elements: suggestedElements,
      must_show_elements: draft.must_show_elements || serializeSuggestedElements(suggestedElements),
      reference_materials: referenceMaterials,
      links: normalizeLegacyLinks(draft, referenceMaterials),
      ai_context: normalizeAiContext(draft)
    };
  }

  router.post('/generate', async (req, res, next) => {
    try {
      const url = String(req.body?.url || '').trim();
      const prompt = String(req.body?.prompt || '').trim();
      const outputText = String(req.body?.outputText || req.body?.output_text || '').trim();
      const screenshotNote = String(req.body?.screenshotNote || req.body?.screenshot_note || '').trim();
      const hasManualSource = Boolean(prompt || outputText || screenshotNote);

      if (!url && !hasManualSource) {
        return res.status(400).json({ error: 'Please enter a valid webpage URL or provide prompt/output materials.' });
      }

      if (url && !/^https?:\/\/.+/i.test(url)) {
        return res.status(400).json({ error: 'Please enter a valid webpage URL.' });
      }

      if (url && isPrivateUrl(url)) {
        return res.status(400).json({ error: 'URLs pointing to private or internal addresses are not allowed.' });
      }

      if (!generateUseCaseDraft) {
        return res.status(400).json({ error: 'AI generation is not configured.' });
      }

      const draft = await generateUseCaseDraft({
        url,
        prompt,
        outputText,
        screenshotNote,
        aiContext: normalizeAiContext(req.body),
        fieldHints: normalizeFieldHints(req.body)
      });
      res.json(normalizeDraftResponse(draft, normalizeFieldHints(req.body)));
    } catch (error) {
      if (error instanceof UserFacingError) {
        return res.status(error.statusCode || 400).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const title = String(req.body.title || '').trim();
      if (!title) {
        return res.status(400).json({ error: 'Title is required.' });
      }
      const suggestedElements = normalizeSuggestedElements(req.body);
      const referenceMaterials = normalizeReferenceMaterials(req.body);
      const legacyLinks = normalizeLegacyLinks(req.body, referenceMaterials);
      const aiContext = normalizeAiContext(req.body);
      const { rows } = await db.query(
        `
        insert into use_cases (
          id, title, description, opening_hook, who_this_is_for, problem,
          how_to_show_it, expected_outcome, must_show_elements, suggested_elements_json, reference_materials_json, ai_context_json, links_json
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)
        returning *
        `,
        [
          `uc_${crypto.randomUUID()}`,
          title,
          req.body.description || '',
          req.body.openingHook || req.body.opening_hook || '',
          req.body.whoThisIsFor || '',
          req.body.problem || '',
          req.body.howToShowIt || '',
          req.body.expectedOutcome || '',
          serializeSuggestedElements(suggestedElements),
          JSON.stringify(suggestedElements),
          JSON.stringify(referenceMaterials),
          JSON.stringify(aiContext),
          JSON.stringify(legacyLinks)
        ]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const suggestedElements = normalizeSuggestedElements(req.body);
      const referenceMaterials = normalizeReferenceMaterials(req.body);
      const legacyLinks = normalizeLegacyLinks(req.body, referenceMaterials);
      const aiContext = normalizeAiContext(req.body);
      const { rows } = await db.query(
        `
        update use_cases
        set
          title = $1,
          description = $2,
          opening_hook = $3,
          who_this_is_for = $4,
          problem = $5,
          how_to_show_it = $6,
          expected_outcome = $7,
          must_show_elements = $8,
          suggested_elements_json = $9::jsonb,
          reference_materials_json = $10::jsonb,
          ai_context_json = $11::jsonb,
          links_json = $12::jsonb,
          updated_at = now()
        where id = $13
        returning *
        `,
        [
          req.body.title,
          req.body.description || '',
          req.body.openingHook || req.body.opening_hook || '',
          req.body.whoThisIsFor || '',
          req.body.problem || '',
          req.body.howToShowIt || '',
          req.body.expectedOutcome || '',
          serializeSuggestedElements(suggestedElements),
          JSON.stringify(suggestedElements),
          JSON.stringify(referenceMaterials),
          JSON.stringify(aiContext),
          JSON.stringify(legacyLinks),
          req.params.id
        ]
      );
      res.json(rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await db.query('delete from use_cases where id = $1', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
