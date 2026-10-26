const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Where the SQLite file is stored.
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'commissions.db');

// Table definitions
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,          -- YYYY-MM-DD
  email TEXT NOT NULL,
  phone_country_code TEXT,              -- e.g. +91
  phone_number TEXT,                    -- digits only, without the country code
  commission_title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget REAL NOT NULL,
  currency TEXT NOT NULL,
  expected_delivery TEXT NOT NULL,      -- YYYY-MM-DD
  additional_details TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  landmark TEXT,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  pincode TEXT NOT NULL,
  reference_images TEXT,                -- JSON list of upload URLs, e.g. ["/api/uploads/ab12....jpg"]
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

const CREATE_ABOUT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS about_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  tagline TEXT,
  bio TEXT,
  photo TEXT,                           -- data:image/jpeg;base64,...
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

const CREATE_WORKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL DEFAULT 'works',
  position INTEGER NOT NULL,
  media_url TEXT,                       -- e.g. /api/uploads/3f9c....mp4
  media_type TEXT,                      -- 'image' or 'video'
  title TEXT,
  text TEXT,
  link_url TEXT,                        -- tutorials: YouTube video ID
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

// Order of columns used for inserts. Keys match the fields the React form sends.
const COLUMNS = [
  ['firstName', 'first_name'],
  ['middleName', 'middle_name'],
  ['lastName', 'last_name'],
  ['dateOfBirth', 'date_of_birth'],
  ['email', 'email'],
  ['phoneCountryCode', 'phone_country_code'],
  ['phoneNumber', 'phone_number'],
  ['commissionTitle', 'commission_title'],
  ['description', 'description'],
  ['budget', 'budget'],
  ['currency', 'currency'],
  ['expectedDelivery', 'expected_delivery'],
  ['additionalDetails', 'additional_details'],
  ['addressLine1', 'address_line1'],
  ['addressLine2', 'address_line2'],
  ['landmark', 'landmark'],
  ['state', 'state'],
  ['country', 'country'],
  ['pincode', 'pincode'],
  ['referenceImagesJson', 'reference_images'],
];

let db;

// Columns added after the first version of the table to preserve existing data.
const ADDED_COLUMNS = {
  commissions: {
    phone_country_code: 'TEXT',
    phone_number: 'TEXT',
    reference_images: 'TEXT',
  },
  works: {
    collection: "TEXT NOT NULL DEFAULT 'works'",
    link_url: 'TEXT',
  },
};

function addMissingColumns() {
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const tableInfo = db.exec(`PRAGMA table_info(${table})`);
    if (tableInfo.length === 0) continue;

    const existing = new Set(tableInfo[0].values.map(row => row[1]));
    for (const [column, type] of Object.entries(columns)) {
      if (!existing.has(column)) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    }
  }
}

/** Writes the in-memory SQLite database to disk. */
function persist() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

/** Opens (or creates) the database and makes sure tables exist. Call once at startup. */
async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();

  db.run(CREATE_TABLE_SQL);
  db.run(CREATE_ABOUT_TABLE_SQL);
  db.run(CREATE_WORKS_TABLE_SQL);

  addMissingColumns();
  persist();
}

/**
 * Stores one commission order and returns its new id.
 * `order` is an object with camelCase keys matching COLUMNS.
 */
async function saveCommission(order) {
  const columnNames = COLUMNS.map(([, column]) => column).join(', ');
  const placeholders = COLUMNS.map(() => '?').join(', ');
  const values = COLUMNS.map(([key]) => (order[key] === '' || order[key] === undefined ? null : order[key]));

  db.run(
    `INSERT INTO commissions (${columnNames}) VALUES (${placeholders})`,
    values
  );

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  persist();
  return id;
}

/** Helper to transform sql.js result sets into plain objects */
function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(row.map((value, i) => [columns[i], value])));
}

function toItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    collection: row.collection,
    position: row.position,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    title: row.title,
    text: row.text,
    link: row.link_url,
  };
}

/** Returns all commission orders, newest first. */
async function listCommissions() {
  const result = db.exec('SELECT * FROM commissions ORDER BY id DESC');
  return rowsToObjects(result);
}

/** Every reference image URL attached to any order (so cleanup never deletes them). */
async function listReferenceImageUrls() {
  const result = db.exec('SELECT reference_images FROM commissions WHERE reference_images IS NOT NULL');
  if (result.length === 0) return [];
  return result[0].values.flatMap(([json]) => {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  });
}

/** Returns the About profile, or null if the admin hasn't saved one yet. */
async function getAbout() {
  const result = db.exec('SELECT name, tagline, bio, photo, updated_at FROM about_profile WHERE id = 1');
  if (result.length === 0) return null;
  const [name, tagline, bio, photo, updatedAt] = result[0].values[0];
  return { name, tagline, bio, photo, updatedAt };
}

/** Creates or replaces the About profile. */
async function saveAbout({ name, tagline, bio, photo }) {
  db.run(
    `INSERT INTO about_profile (id, name, tagline, bio, photo, updated_at) 
     VALUES (1, ?, ?, ?, ?, datetime('now')) 
     ON CONFLICT(id) DO UPDATE SET 
       name = excluded.name, 
       tagline = excluded.tagline, 
       bio = excluded.bio, 
       photo = excluded.photo, 
       updated_at = excluded.updated_at`,
    [name, tagline || null, bio || null, photo || null]
  );
  persist();
  return getAbout();
}

/** All items of one collection, in display order. */
async function listItems(collection) {
  const result = db.exec('SELECT * FROM works WHERE collection = ? ORDER BY position, id', [collection]);
  return rowsToObjects(result).map(toItem);
}

/** Every uploaded file used by any collection (so cleanup never deletes them). */
async function listItemMediaUrls() {
  const result = db.exec('SELECT media_url FROM works WHERE media_url IS NOT NULL');
  return result.length ? result[0].values.map(([url]) => url) : [];
}

/** Gets a single item from a collection by ID. */
async function getItem(collection, id) {
  const result = db.exec('SELECT * FROM works WHERE collection = ? AND id = ?', [collection, id]);
  const rows = rowsToObjects(result);
  return toItem(rows[0]);
}

/** Adds an item at the end of a collection. */
async function createItem(collection, { mediaUrl, mediaType, title, text, link }) {
  const next = db.exec('SELECT COALESCE(MAX(position), 0) + 1 FROM works WHERE collection = ?', [collection])[0].values[0][0];

  db.run(
    'INSERT INTO works (collection, position, media_url, media_type, title, text, link_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [collection, next, mediaUrl || null, mediaType || null, title || null, text || null, link || null]
  );

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  persist();
  return getItem(collection, id);
}

/** Updates an item in a collection. */
async function updateItem(collection, id, { mediaUrl, mediaType, title, text, link }) {
  if (!(await getItem(collection, id))) return null;

  db.run(
    `UPDATE works 
     SET media_url = ?, media_type = ?, title = ?, text = ?, link_url = ?, updated_at = datetime('now') 
     WHERE collection = ? AND id = ?`,
    [mediaUrl || null, mediaType || null, title || null, text || null, link || null, collection, id]
  );

  persist();
  return getItem(collection, id);
}

/** Deletes an item. Returns the deleted item (so its file can be removed), or null. */
async function deleteItem(collection, id) {
  const item = await getItem(collection, id);
  if (!item) return null;

  db.run('DELETE FROM works WHERE collection = ? AND id = ?', [collection, id]);
  persist();
  return item;
}

/** Swaps an item with its neighbour. direction: -1 earlier, +1 = later. */
async function moveItem(collection, id, direction) {
  const items = await listItems(collection);
  const index = items.findIndex(item => item.id === id);
  const other = items[index + direction];

  if (index === -1 || !other) return items;

  // Swap adjacent items
  [items[index], items[index + direction]] = [other, items[index]];

  // Renumber the collection 1..n
  items.forEach((item, i) => {
    db.run('UPDATE works SET position = ? WHERE id = ?', [i + 1, item.id]);
  });

  persist();
  return listItems(collection);
}

module.exports = {
  initDb,
  saveCommission,
  listCommissions,
  listReferenceImageUrls,
  getAbout,
  saveAbout,
  listItems,
  listItemMediaUrls,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  moveItem,
};