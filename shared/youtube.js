/**
 * Pulls the 11-character video ID out of any common YouTube link:
 * youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID (with or without extras).
 *
 * Used by the tutorial form (to catch bad links before uploading anything) and by
 * the server (which stores only the ID, so the site always builds its own safe embed address).
 */
function youtubeId(input) {
  if (typeof input !== 'string') return null;

  const value = input.trim();
  // Already just the raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;

  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.searchParams.get('v') ||
      (url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1];
  }

  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

module.exports = { youtubeId };