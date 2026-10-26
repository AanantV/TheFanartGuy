const express = require('express');
const cors = require('cors');

const {
  initDb,
  saveCommission,
  listCommissions,
  listReferenceImageUrls,
  getAbout,
  saveAbout,
  listItemMediaUrls,
} = require('./db');

const { login, logout, checkSession, requireAdmin } = require('./auth');
const { mountUploads, isOurImageUpload, cleanUpOrphanUploads } = require('./uploads');
const { mountCollections } = require('./collections');
const { notifyNewOrder } = require('./email');

const MAX_REFERENCE_IMAGES = 5;
const { COUNTRIES } = require('../shared/countries');

// Shown on the About page until the admin saves their own details.
const { DEFAULT_ABOUT } = require('../shared/aboutDefaults');

const COUNTRY_BY_NAME = new Map(COUNTRIES.map(c => [c.name, c]));
const PORT = process.env.PORT || 4000;

// Which websites may call this API from the browser. Add your live site here,
// e.g. ALLOWED_ORIGINS=https://aanantv.github.io (comma-separated for several).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
  .split(',')
  .map(origin => origin.trim());

const app = express();

app.use(cors({ origin: ALLOWED_ORIGINS }));

// --- About page ---
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_PHOTO_CHARS = 2_500_000; // about 1.8 MB of image data

// Registered before the general JSON parser below, because it needs a larger size limit to carry the photo.
app.put('/api/about', requireAdmin, express.json({ limit: '3mb' }), async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  const photo = body.photo || null;

  const errors = {};

  if (!name) errors.name = 'Name is required.';
  else if (name.length > 80) errors.name = 'Must be 80 characters or fewer.';

  if (tagline.length > 150) errors.tagline = 'Must be 150 characters or fewer.';
  if (bio.length > 5000) errors.bio = 'Must be 5000 characters or fewer.';

  if (photo && (typeof photo !== 'string' || !PHOTO_PATTERN.test(photo) || photo.length > MAX_PHOTO_CHARS)) {
    errors.photo = 'Photo must be a JPEG, PNG or WebP image under about 1.8 MB.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
  }

  try {
    res.json(await saveAbout({ name, tagline, bio, photo }));
  } catch (err) {
    console.error('Failed to save About profile:', err);
    res.status(500).json({ message: 'Could not save. Please try again.' });
  }
});

// File uploads use their own body parser, so they're mounted before the JSON one.
mountUploads(app, requireAdmin);

app.use(express.json({ limit: '100kb' }));

app.get('/api/about', async (req, res) => {
  res.json((await getAbout()) || DEFAULT_ABOUT);
});

// Admin-managed lists (works, wallpapers, tutorials, gallery)
mountCollections(app, requireAdmin);

// Admin login routes
app.post('/api/admin/login', login);
app.post('/api/admin/logout', logout);
app.get('/api/admin/session', checkSession);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PINCODE_PATTERN = /^[A-Za-z0-9]{3,10}$/;
const PHONE_PATTERN = /^\d{4,14}$/;

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

// Max length for each text field; required fields are marked true.
const TEXT_FIELDS = {
  firstName: [true, 50],
  middleName: [false, 50],
  lastName: [true, 50],
  email: [true, 120],
  commissionTitle: [true, 120],
  description: [true, 3000],
  additionalDetails: [false, 3000],
  addressLine1: [true, 150],
  addressLine2: [false, 150],
  landmark: [false, 100],
  state: [true, 60],
  country: [true, 60],
  pincode: [true, 10],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks and cleans the submitted order.
 * Returns { order, errors } where errors maps field name -> message.
 */
function validateOrder(body) {
  const errors = {};
  const order = {};

  for (const [field, [required, maxLength]] of Object.entries(TEXT_FIELDS)) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (required && !value) {
      errors[field] = 'This field is required.';
    } else if (value.length > maxLength) {
      errors[field] = `Must be ${maxLength} characters or fewer.`;
    }
    order[field] = value;
  }

  if (order.email && !EMAIL_PATTERN.test(order.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (order.pincode && !PINCODE_PATTERN.test(order.pincode)) {
    errors.pincode = 'Enter a valid pincode.';
  }

  if (order.country && !COUNTRY_BY_NAME.has(order.country)) {
    errors.country = 'Choose a country from the list.';
  }

  // Contact number lookup
  const phoneCountry = COUNTRY_BY_NAME.get(body.phoneCountry);
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.replace(/[\s\-().]/g, '') : '';

  if (!phoneCountry) {
    errors.phoneNumber = 'Choose a country code.';
  } else if (!phoneNumber) {
    errors.phoneNumber = 'This field is required.';
  } else if (!PHONE_PATTERN.test(phoneNumber)) {
    errors.phoneNumber = 'Enter a valid phone number.';
  }

  order.phoneCountryCode = phoneCountry ? phoneCountry.dialCode : '';
  order.phoneNumber = phoneNumber;

  const dob = body.dateOfBirth;
  if (!dob || !DATE_PATTERN.test(dob)) {
    errors.dateOfBirth = 'Enter your date of birth.';
  } else if (dob > today()) {
    errors.dateOfBirth = 'Date of birth must be in the past.';
  }
  order.dateOfBirth = dob;

  const delivery = body.expectedDelivery;
  if (!delivery || !DATE_PATTERN.test(delivery)) {
    errors.expectedDelivery = 'Choose an expected delivery date.';
  } else if (delivery < today()) {
    errors.expectedDelivery = 'Delivery date must be in the future.';
  }
  order.expectedDelivery = delivery;

  const budget = Number(body.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    errors.budget = 'Enter a budget greater than 0.';
  }
  order.budget = budget;
  order.currency = CURRENCIES.includes(body.currency) ? body.currency : 'INR';

  // Optional reference images
  const references = Array.isArray(body.referenceImages) ? body.referenceImages : [];
  if (references.length > MAX_REFERENCE_IMAGES) {
    errors.referenceImages = `You can attach up to ${MAX_REFERENCE_IMAGES} images.`;
  } else if (!references.every(isOurImageUpload)) {
    errors.referenceImages = 'Please upload your reference images again.';
  }

  order.referenceImages = [...new Set(references)];
  order.referenceImagesJson = order.referenceImages.length ? JSON.stringify(order.referenceImages) : null;

  return { order, errors };
}

app.post('/api/commissions', async (req, res) => {
  const { order, errors } = validateOrder(req.body || {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
  }

  try {
    const id = await saveCommission(order);
    res.status(201).json({ id, message: 'Commission order saved.' });

    // Email a copy after replying so slow mail doesn't delay client response
    notifyNewOrder(order, id);
  } catch (err) {
    console.error('Failed to save commission:', err);
    res.status(500).json({ message: 'Could not save your order. Please try again later.' });
  }
});

// Admin-only commission list
app.get('/api/commissions', requireAdmin, async (req, res) => {
  res.json(await listCommissions());
});

// Startup sequence
initDb()
  .then(async () => {
    await cleanUpOrphanUploads([
      ...(await listItemMediaUrls()),
      ...(await listReferenceImageUrls()),
    ]);

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
      if (!process.env.ADMIN_PASSWORD) {
        console.warn('ADMIN_PASSWORD is not set: admin login is disabled. See server/.env.example.');
      }
    });
  })
  .catch(err => {
    console.error('Could not open the database:', err);
    process.exit(1);
  });