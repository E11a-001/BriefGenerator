import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

const FIELD_MAP = {
  name: 'name',
  platform: 'platform',
  email: 'email',
  channelUrl: 'channel_url',
  channel_url: 'channel_url',
  audience_profile_text: 'audience_profile_text',
  audienceProfileText: 'audience_profile_text',
  primary_use_case_id: 'primary_use_case_id',
  primaryUseCaseId: 'primary_use_case_id',
  status: 'status',
  draft_video: 'draft_video_url',
  draftVideo: 'draft_video_url',
  script: 'script_value',
  final_video: 'final_video_url',
  finalVideo: 'final_video_url'
};

function buildAudienceImageId() {
  return `img_${crypto.randomUUID()}`;
}

function sanitizeFileName(fileName = '') {
  const normalized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || 'audience-image.png';
}

function parseImageDataUrl(dataUrl = '') {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Image upload must be a valid base64 data URL.');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

export function createAudienceImageUploadHandler(db, uploadsDir) {
  return async function uploadAudienceImage(req, res, next) {
    try {
      const imageId = buildAudienceImageId();
      const safeFileName = sanitizeFileName(req.body.fileName);
      const { buffer } = parseImageDataUrl(req.body.dataUrl);
      const relativeDir = path.join('audience', req.params.id);
      const absoluteDir = path.join(uploadsDir, relativeDir);
      const storedFileName = `${imageId}-${safeFileName}`;
      const absolutePath = path.join(absoluteDir, storedFileName);
      const fileUrl = `/${path.posix.join('uploads', 'audience', req.params.id, storedFileName)}`;

      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(absolutePath, buffer);

      const { rows } = await db.query(
        `
        insert into koc_audience_images (id, koc_id, file_name, file_url)
        values ($1, $2, $3, $4)
        returning *
        `,
        [imageId, req.params.id, safeFileName, fileUrl]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  };
}

export function createAudienceImageDeleteHandler(db, uploadsDir) {
  return async function deleteAudienceImage(req, res, next) {
    try {
      const { rows } = await db.query(
        'select * from koc_audience_images where id = $1 and koc_id = $2 limit 1',
        [req.params.imageId, req.params.id]
      );

      if (!rows[0]) {
        res.status(404).json({ error: 'Audience image not found' });
        return;
      }

      const fileName = path.basename(rows[0].file_url);
      await fs.rm(path.join(uploadsDir, 'audience', req.params.id, fileName), { force: true });
      await db.query('delete from koc_audience_images where id = $1 and koc_id = $2', [
        req.params.imageId,
        req.params.id
      ]);

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

export function createKocRoutes(db, options = {}) {
  const router = Router();
  const uploadsDir = options.uploadsDir;

  router.post('/', async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Name is required.' });
      }
      const { rows } = await db.query(
        `
        insert into kocs (
          id, name, platform, email, channel_url, status
        ) values ($1, $2, $3, $4, $5, 'draft')
        returning *
        `,
        [
          `koc_${crypto.randomUUID()}`,
          name,
          req.body.platform || 'YouTube',
          req.body.email || '',
          req.body.channelUrl || ''
        ]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const [clientField, value] = Object.entries(req.body)[0];
      const column = FIELD_MAP[clientField];
      if (!column) {
        res.status(400).json({ error: `Unsupported field: ${clientField}` });
        return;
      }

      const { rows } = await db.query(
        `update kocs set ${column} = $1, updated_at = now() where id = $2 returning *`,
        [value, req.params.id]
      );
      res.json(rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/use-cases', async (req, res, next) => {
    const client = await db.connect();
    try {
      const requestedIds = Array.isArray(req.body.useCaseIds) ? req.body.useCaseIds : [];
      const requestedPrimary = String(req.body.primaryUseCaseId || '').trim();
      const resolvedPrimary = requestedIds.includes(requestedPrimary)
        ? requestedPrimary
        : (requestedIds[0] || '');

      await client.query('BEGIN');
      await client.query('delete from koc_use_cases where koc_id = $1', [req.params.id]);
      for (const useCaseId of requestedIds) {
        await client.query(
          'insert into koc_use_cases (koc_id, use_case_id) values ($1, $2)',
          [req.params.id, useCaseId]
        );
      }
      await client.query(
        'update kocs set primary_use_case_id = $1, updated_at = now() where id = $2 returning *',
        [resolvedPrimary, req.params.id]
      );
      await client.query('COMMIT');
      res.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  });

  router.post('/:id/audience-images', createAudienceImageUploadHandler(db, uploadsDir));
  router.delete('/:id/audience-images/:imageId', createAudienceImageDeleteHandler(db, uploadsDir));

  router.delete('/:id', async (req, res, next) => {
    try {
      await db.query('delete from kocs where id = $1', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
