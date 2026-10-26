const { listItems, getItem, createItem, updateItem, deleteItem, moveItem } = require('./db');
const { deleteUpload, isOurUpload } = require('./uploads');
const { youtubeId } = require('../shared/youtube');

const COLLECTIONS = {
  works: { media: ['image', 'video'], mediaRequired: false },
  wallpapers: { media: ['image'], mediaRequired: true },
  tutorials: { media: ['image'], mediaRequired: true, youtube: true, titleRequired: true },
  gallery: { media: ['image'], mediaRequired: true },
};

function validateItem(rules, body) {
  const errors = {};

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const mediaUrl = body.mediaUrl || null;
  const mediaType = mediaUrl ? body.mediaType : null;
  let link = null;

  if (mediaUrl && !isOurUpload(mediaUrl)) {
    errors.media = 'Upload the file again.';
  } else if (mediaUrl && !rules.media.includes(mediaType)) {
    errors.media = `This list only accepts ${rules.media.join(' or ')} files.`;
  } else if (!mediaUrl && rules.mediaRequired) {
    errors.media = rules.youtube ? 'Add a thumbnail image.' : 'Add an image.';
  }

  if (rules.youtube) {
    link = youtubeId(body.link);
    if (!link) {
      errors.link = 'Paste a valid YouTube video link.';
    }
  }

  if (rules.titleRequired && !title) errors.title = 'Title is required.';
  if (title.length > 120) errors.title = 'Must be 120 characters or fewer.';
  if (text.length > 5000) errors.text = 'Must be 5000 characters or fewer.';

  if (!mediaUrl && !title && !text) {
    errors.text = 'Add an image/video or some text.';
  }

  return { item: { mediaUrl, mediaType, title, text, link }, errors };
}

function mountCollections(app, requireAdmin) {
  // Rejects unknown collection names before any handler runs.
  app.param('collection', (req, res, next, name) => {
    if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, name)) {
      return res.status(404).json({ message: 'Unknown list.' });
    }
    req.collection = name;
    req.rules = COLLECTIONS[name];
    next();
  });

  const itemId = req => Number.parseInt(req.params.id, 10);
  const invalid = (res, errors) =>
    res.status(400).json({ message: 'Please fix the highlighted fields.', errors });

  app.get('/api/collections/:collection', async (req, res) => {
    res.json(await listItems(req.collection));
  });

  app.post('/api/collections/:collection', requireAdmin, async (req, res) => {
    const { item, errors } = validateItem(req.rules, req.body || {});
    if (Object.keys(errors).length) return invalid(res, errors);
    res.status(201).json(await createItem(req.collection, item));
  });

  app.put('/api/collections/:collection/:id', requireAdmin, async (req, res) => {
    const { item, errors } = validateItem(req.rules, req.body || {});
    if (Object.keys(errors).length) return invalid(res, errors);

    const before = await getItem(req.collection, itemId(req));
    if (!before) return res.status(404).json({ message: 'That entry no longer exists.' });

    const updated = await updateItem(req.collection, before.id, item);

    // Remove the old file if the media was replaced or removed.
    if (before.mediaUrl && before.mediaUrl !== updated.mediaUrl) {
      await deleteUpload(before.mediaUrl);
    }

    res.json(updated);
  });

  app.delete('/api/collections/:collection/:id', requireAdmin, async (req, res) => {
    const removed = await deleteItem(req.collection, itemId(req));
    if (!removed) return res.status(404).json({ message: 'That entry no longer exists.' });
    if (removed.mediaUrl) await deleteUpload(removed.mediaUrl);
    res.json({ message: 'Deleted.' });
  });

  app.post('/api/collections/:collection/:id/move', requireAdmin, async (req, res) => {
    const direction =
      req.body?.direction === 'up' ? -1 : req.body?.direction === 'down' ? 1 : 0;
    if (!direction) {
      return res.status(400).json({ message: "direction must be 'up' or 'down'." });
    }

    res.json(await moveItem(req.collection, itemId(req), direction));
  });
}

module.exports = { mountCollections };