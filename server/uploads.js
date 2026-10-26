const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
const PUBLIC_PREFIX = '/api/uploads/';
const MAX_UPLOAD_MB = 60;

// Allowed file types -> [extension, media type]
const ALLOWED_TYPES = {
  'image/jpeg': ['jpg', 'image'],
  'image/png': ['png', 'image'],
  'image/webp': ['webp', 'image'],
  'image/gif': ['gif', 'image'],
  'video/mp4': ['mp4', 'video'],
  'video/webm': ['webm', 'video'],
};

// First bytes of each format, so a renamed file (e.g. a script called photo.jpg) is rejected.
function looksLike(buffer, contentType) {
  const hex = buffer.subarray(0, 12).toString('hex');

  switch (contentType) {
    case 'image/jpeg':
      return hex.startsWith('ffd8ff');
    case 'image/png':
      return hex.startsWith('89504e47');
    case 'image/gif':
      return hex.startsWith('47494638');
    case 'image/webp':
      return hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/mp4':
      return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'video/webm':
      return hex.startsWith('1a45dfa3');
    default:
      return false;
  }
}

/** Saves the file and returns { url, mediaType }. */
async function saveUpload(buffer, contentType) {
  const [ext, mediaType] = ALLOWED_TYPES[contentType];
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buffer);

  return { url: PUBLIC_PREFIX + name, mediaType };
}

/**
 * Deletes a previously uploaded file (ignores URLs that aren't ours).
 * On Windows a file can't be deleted while someone is still streaming it,
 * so failed deletes are retried for a couple of minutes.
 */
async function deleteUpload(url, attempt = 1) {
  if (!isOurUpload(url)) return;

  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(url)));
  } catch (err) {
    if (err.code === 'ENOENT') return; // already gone
    if (attempt < 6) {
      setTimeout(() => deleteUpload(url, attempt + 1), attempt * 10_000).unref();
    } else {
      console.warn(`Could not delete ${url}; it will be removed on the next server start.`);
    }
  }
}

/**
 * Removes uploaded files that nothing points to (left over from failed deletes,
 * works whose Save never finished, or reference images from abandoned orders).
 * Files from the last hour are kept in case an upload is still in progress.
 */
async function cleanUpOrphanUploads(usedUrls) {
  const used = new Set(usedUrls.filter(Boolean).map(url => path.basename(url)));
  const names = await fs.promises.readdir(UPLOAD_DIR).catch(() => []);
  const hourAgo = Date.now() - 60 * 60 * 1000;

  for (const name of names) {
    if (used.has(name) || !isOurUpload(PUBLIC_PREFIX + name)) continue;

    const { mtimeMs } = await fs.promises.stat(path.join(UPLOAD_DIR, name));
    if (mtimeMs < hourAgo) {
      await deleteUpload(PUBLIC_PREFIX + name, 6);
    }
  }
}

/** True if the URL points at a file this server stored (prevents linking arbitrary paths). */
function isOurUpload(url) {
  return typeof url === 'string' && /^\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|gif|mp4|webm)$/.test(url);
}

/** Same check, images only (used for commission reference images). */
function isOurImageUpload(url) {
  return isOurUpload(url) && /\.(jpg|png|webp|gif)$/.test(url);
}

function uploadPath(url) {
  return path.join(UPLOAD_DIR, path.basename(url));
}

// Reference images from visitors (commission form)
const REFERENCE_MAX_MB = 10;
const REFERENCE_UPLOADS_PER_HOUR = 20;
const IMAGE_TYPES = Object.keys(ALLOWED_TYPES).filter(type => type.startsWith('image/'));
const referenceUploads = new Map(); // ip -> timestamps of recent uploads

function underRateLimit(ip) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (referenceUploads.get(ip) || []).filter(time => time > hourAgo);

  if (recent.length >= REFERENCE_UPLOADS_PER_HOUR) return false;

  recent.push(Date.now());
  referenceUploads.set(ip, recent);
  return true;
}

/** Mounts the upload routes and GET /api/uploads/<file> (public). */
function mountUploads(app, requireAdmin) {
  app.post(
    '/api/commissions/reference-images',
    express.raw({ type: IMAGE_TYPES, limit: `${REFERENCE_MAX_MB}mb` }),
    async (req, res) => {
      if (!underRateLimit(req.ip)) {
        return res.status(429).json({ message: 'Too many uploads. Please try again in an hour.' });
      }

      const contentType = (req.get('Content-Type') || '').split(';')[0].trim();

      if (!IMAGE_TYPES.includes(contentType) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: 'Upload a JPEG, PNG, WebP or GIF image.' });
      }

      if (!looksLike(req.body, contentType)) {
        return res.status(400).json({ message: 'That file does not look like a real image.' });
      }

      try {
        res.status(201).json(await saveUpload(req.body, contentType));
      } catch (err) {
        console.error('Reference upload failed:', err);
        res.status(500).json({ message: 'Could not save the image.' });
      }
    }
  );

  app.post(
    '/api/uploads',
    requireAdmin,
    express.raw({ type: Object.keys(ALLOWED_TYPES), limit: `${MAX_UPLOAD_MB}mb` }),
    async (req, res) => {
      const contentType = (req.get('Content-Type') || '').split(';')[0].trim();

      if (!ALLOWED_TYPES[contentType] || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ message: 'Upload a JPEG, PNG, WebP, GIF, MP4 or WebM file.' });
      }

      if (!looksLike(req.body, contentType)) {
        return res.status(400).json({ message: 'That file does not look like a real image or video.' });
      }

      try {
        res.status(201).json(await saveUpload(req.body, contentType));
      } catch (err) {
        console.error('Upload failed:', err);
        res.status(500).json({ message: 'Could not save the file.' });
      }
    }
  );

  // ?download=Nice%20Name makes the browser save the file instead of opening it.
  app.use(PUBLIC_PREFIX, (req, res, next) => {
    const wanted = typeof req.query.download === 'string' ? req.query.download : '';
    if (wanted) {
      const safe = wanted.replace(/[^\w\s.()-]/g, '').trim().slice(0, 80) || 'wallpaper';
      res.attachment(safe + path.extname(req.path));
    }
    next();
  });

  app.use(
    PUBLIC_PREFIX,
    express.static(UPLOAD_DIR, {
      maxAge: '30d',
      setHeaders: res => res.set('X-Content-Type-Options', 'nosniff'),
    })
  );

  // Friendly error when a file is bigger than the limit.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      const limitMb = Math.round(err.limit / (1024 * 1024));
      return res.status(413).json({ message: `File is too big. The limit is ${limitMb} MB.` });
    }
    next(err);
  });
}

module.exports = {
  mountUploads,
  deleteUpload,
  isOurUpload,
  isOurImageUpload,
  uploadPath,
  cleanUpOrphanUploads,
  REFERENCE_MAX_MB,
};