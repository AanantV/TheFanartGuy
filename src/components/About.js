import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, useAdmin } from '../api';
import { DEFAULT_ABOUT } from '../../shared/aboutDefaults';
import Works from './Works';

// Files picked up from src/media/ (see src/media/README.txt):
// intro.mp4/intro.webm: looping intro video (hidden if missing)
// intro-poster.jpg: optional image shown while the video loads
// photo.jpg/.png/.webp: profile photo, used until you upload one with Edit

const media = require.context('../media', false, /^\.\/(intro|intro-poster|photo)\.(mp4|webm|jpe?g|png|webp)$/i);

const findMedia = pattern => {
  const key = media.keys().find(k => pattern.test(k));
  return key ? media(key) : null;
};

const INTRO_VIDEO = findMedia(/^\.\/intro\.(mp4|webm)$/i);
const INTRO_POSTER = findMedia(/^\.\/intro-poster\./i);
const PHOTO_FILE = findMedia(/^\.\/photo\./i);

const PHOTO_MAX_SIZE = 600; // px; uploaded photos are shrunk to this before saving

// Shrinks the chosen photo in the browser and returns it as a JPEG data URL,
// so the saved image is small (usually under 150 KB) whatever the original size.
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };

    img.src = url;
  });
}

function IntroVideo() {
  const { isAdmin } = useAdmin();

  if (!INTRO_VIDEO) {
    // Only you see this reminder; visitors see nothing until the video is added.
    return isAdmin ? (
      <div className="intro-video intro-video-empty">
        Add your intro video as <code>src/media/intro.mp4</code> and it will play here.
      </div>
    ) : null;
  }

  return (
    <div className="intro-video">
      <video
        src={INTRO_VIDEO}
        poster={INTRO_POSTER || undefined}
        autoPlay
        muted
        loop
        playsInline
        aria-label="TheFanartGuy art intro"
      />
    </div>
  );
}

function About() {
  const { isAdmin, token } = useAdmin();
  const [profile, setProfile] = useState(DEFAULT_ABOUT);
  const [draft, setDraft] = useState(null); // non-null while editing
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    apiFetch('/api/about')
      .then(({ ok, data }) => {
        if (ok) setProfile(data);
      })
      .catch(() => {}); // server not reachable: keep showing the defaults
  }, []);

  // Leave edit mode if the admin logs out mid-edit.
  useEffect(() => {
    if (!isAdmin) setDraft(null);
  }, [isAdmin]);

  const startEditing = () => {
    setDraft({
      name: profile.name || '',
      tagline: profile.tagline || '',
      bio: profile.bio || '',
      photo: profile.photo || null,
    });
    setErrors({});
    setMessage('');
  };

  const cancelEditing = () => {
    setDraft(null);
    setErrors({});
    setMessage('');
  };

  const updateDraft = e => {
    setDraft(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const choosePhoto = async e => {
    const file = e.target.files[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;

    try {
      const photo = await resizePhoto(file);
      setDraft(prev => ({ ...prev, photo }));
      setErrors(prev => ({ ...prev, photo: undefined }));
    } catch (err) {
      setErrors(prev => ({ ...prev, photo: err.message }));
    }
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setErrors({ name: 'Name is required.' });
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const { ok, status, data } = await apiFetch('/api/about', {
        method: 'PUT',
        body: draft,
        token,
      });

      if (!ok) {
        setErrors(data.errors || {});
        setMessage(
          status === 401
            ? 'Your admin login has expired. Log in again.'
            : data.message || 'Could not save.'
        );
        return;
      }

      setProfile(data);
      setDraft(null);
    } catch {
      setMessage('Could not reach the server. Is it running?');
    } finally {
      setSaving(false);
    }
  };

  const editing = draft != null;
  const shown = editing ? draft : profile;
  // Uploaded photo wins; otherwise fall back to src/media/photo.jpg if present.
  const photo = shown.photo || PHOTO_FILE;

  return (
    <div className="about">
      <IntroVideo />

      <div className="profile-card">
        <div className="profile-photo-column">
          <div className={`profile-photo ${!photo ? 'profile-photo-empty' : ''}`}>
            {photo ? <img src={photo} alt={shown.name} /> : <span>Photo</span>}
          </div>

          {editing && (
            <div className="photo-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
                hidden
              />
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => fileInput.current && fileInput.current.click()}
              >
                {draft.photo ? 'Change photo' : 'Upload photo'}
              </button>

              {draft.photo && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setDraft(prev => ({ ...prev, photo: null }))}
                >
                  Remove
                </button>
              )}

              {errors.photo && <span className="field-error">{errors.photo}</span>}
            </div>
          )}
        </div>

        <div className="profile-details">
          {editing ? (
            <>
              <div className={`form-field ${errors.name ? 'has-error' : ''}`}>
                <label htmlFor="about-name">Name</label>
                <input
                  id="about-name"
                  name="name"
                  maxLength={80}
                  value={draft.name}
                  onChange={updateDraft}
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className={`form-field ${errors.tagline ? 'has-error' : ''}`}>
                <label htmlFor="about-tagline">Tagline</label>
                <input
                  id="about-tagline"
                  name="tagline"
                  maxLength={150}
                  value={draft.tagline}
                  onChange={updateDraft}
                />
                {errors.tagline && <span className="field-error">{errors.tagline}</span>}
              </div>

              <div className={`form-field ${errors.bio ? 'has-error' : ''}`}>
                <label htmlFor="about-bio">About you</label>
                <textarea
                  id="about-bio"
                  name="bio"
                  rows={6}
                  maxLength={5000}
                  value={draft.bio}
                  onChange={updateDraft}
                />
                {errors.bio && <span className="field-error">{errors.bio}</span>}
              </div>
            </>
          ) : (
            <>
              <h2 className="profile-name">{profile.name}</h2>
              {profile.tagline && <p className="profile-tagline">{profile.tagline}</p>}
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            </>
          )}

          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}

          {/* Edit / Save / Cancel are rendered only for the logged-in admin */}
          {isAdmin && (
            <div className="form-actions">
              {editing ? (
                <>
                  <button
                    key="save"
                    type="button"
                    className="btn btn-primary"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    key="cancel"
                    type="button"
                    className="btn btn-secondary"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  key="edit"
                  type="button"
                  className="btn btn-primary"
                  onClick={startEditing}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Works />
    </div>
  );
}

export default About;