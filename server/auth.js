const crypto = require('crypto');

const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

const sessions = new Map(); // token -> expiry time (ms)
const failedAttempts = new Map(); // ip -> { count, lockedUntil }

function adminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

// Compares in constant time so the password can't be guessed by timing responses.
function passwordMatches(attempt) {
  const expected = crypto.createHash('sha256').update(adminPassword()).digest();
  const given = crypto.createHash('sha256').update(String(attempt)).digest();
  return crypto.timingSafeEqual(expected, given);
}

function login(req, res) {
  if (!adminPassword()) {
    return res.status(503).json({
      message: 'Admin login is not set up. Set ADMIN_PASSWORD on the server.',
    });
  }

  const ip = req.ip;
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    return res.status(429).json({
      message: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
    });
  }

  if (!passwordMatches(req.body?.password ?? '')) {
    record.count += 1;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      record.count = 0;
      record.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
    }
    failedAttempts.set(ip, record);
    return res.status(401).json({ message: 'Wrong password.' });
  }

  // Clear failed attempts on successful login
  failedAttempts.delete(ip);

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  return res.json({ token, expiresInHours: SESSION_HOURS });
}

function tokenFrom(req) {
  const header = req.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function isValidToken(token) {
  if (!token) return false;

  const expiry = sessions.get(token);
  if (!expiry) return false;

  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }

  return true;
}

/** Express middleware: lets the request through only for a logged-in admin. */
function requireAdmin(req, res, next) {
  if (!isValidToken(tokenFrom(req))) {
    return res.status(401).json({ message: 'Admin login required.' });
  }
  next();
}

function logout(req, res) {
  sessions.delete(tokenFrom(req));
  return res.json({ message: 'Logged out.' });
}

/** Lets the website check whether a saved token is still valid. */
function checkSession(req, res) {
  return res.json({ admin: isValidToken(tokenFrom(req)) });
}

module.exports = { login, logout, checkSession, requireAdmin };