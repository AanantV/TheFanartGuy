import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, mediaSrc, uploadFile, useAdmin } from '../api';
import { youtubeId } from '../../shared/youtube';

// Shared pieces for the admin-managed lists (About works, Wallpapers, Tutorials,
// Art Gallery). Each page decides how its items LOOK; loading, saving, editing,
// deleting and reordering all happen here. Server side: server/collections.js.

const MAX_UPLOAD_MB = 60; // keep in sync with server/uploads.js
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/** Loads one collection and returns it plus admin actions. */
export function useCollection(name) {
  const { isAdmin, token } = useAdmin();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState(null); // item id, 'new', or null
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch(`/api/collections/${name}`)
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data)) {
          setItems(data);
        }
      })
      .catch(() => {}) // server not reachable: show nothing
      .finally(() => setLoaded(true));
  }, [name]);

  useEffect(() => {
    if (!isAdmin) setEditingId(null);
  }, [isAdmin]);

  const saved = useCallback(item => {
    setItems(prev =>
      prev.some(i => i.id === item.id)
        ? prev.map(i => (i.id === item.id ? item : i))
        : [...prev, item]
    );
    setEditingId(null);
  }, []);

  const remove = async item => {
    if (!window.confirm(`Delete "${item.title || 'this entry'}"? This can't be undone.`)) {
      return;
    }

    const { ok, data } = await apiFetch(`/api/collections/${name}/${item.id}`, {
      method: 'DELETE',
      token,
    });

    if (ok) {
      setItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setMessage(data?.message || 'Could not delete.');
    }
  };

  const move = async (item, direction) => {
    const { ok, data } = await apiFetch(`/api/collections/${name}/${item.id}/move`, {
      method: 'POST',
      body: { direction },
      token,
    });

    if (ok) {
      setItems(data);
    } else {
      setMessage(data?.message || 'Could not move.');
    }
  };

  return { name, items, loaded, isAdmin, editingId, setEditingId, saved, remove, move, message };
}

/** Edit / Delete / earlier / later buttons shown on each item to the admin only. */
export function AdminItemControls({ collection, item, index, vertical = true }) {
  const { items, editingId, setEditingId, remove, move } = collection;
  const busy = editingId != null;

  return (
    <div className="form-actions item-admin-actions">
      <button
        type="button"
        className="btn btn-primary btn-small"
        onClick={() => setEditingId(item.id)}
        disabled={busy}
      >
        Edit
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => remove(item)}
        disabled={busy}
      >
        Delete
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => move(item, 'up')}
        disabled={busy || index === 0}
        aria-label="Move earlier"
      >
        {vertical ? '↑' : '←'}
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => move(item, 'down')}
        disabled={busy || index === items.length - 1}
        aria-label="Move later"
      >
        {vertical ? '↓' : '→'}
      </button>
    </div>
  );
}

/** Opens the shared editor for a new item. Visitors never see admin controls. */
export function AddItemButton({ collection, label = 'Add item' }) {
  if (!collection.isAdmin) return null;

  return (
    <div className="collection-add">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => collection.setEditingId('new')}
        disabled={collection.editingId != null}
      >
        {label}
      </button>
    </div>
  );
}

/** Shows an image or video. */
export function ItemMedia({ url, type, alt, className = 'work-media', videoProps = {} }) {
  if (!url) return null;

  return (
    <div className={className}>
      {type === 'video' ? (
        <video src={url} controls playsInline preload="metadata" aria-label={alt} {...videoProps} />
      ) : (
        <img src={url} alt={alt} loading="lazy" />
      )}
    </div>
  );
}

/**
 * Add/edit form for one item.
 * fields: { title: { label, required, placeholder }, text: {...}, link: {...} }
 * media: { label, video: true/false, required: true/false, missing: 'message...' }
 */
export function ItemEditor({ collection, item, fields = {}, media = {}, heading }) {
  const { token } = useAdmin();

  const [values, setValues] = useState({
    title: item?.title || '',
    text: item?.text || '',
    link: item?.link ? `https://www.youtube.com/watch?v=${item.link}` : '',
  });

  const [current, setCurrent] = useState(
    item?.mediaUrl ? { url: item.mediaUrl, type: item.mediaType } : null
  );
  const [newFile, setNewFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  const idPrefix = `${collection.name}-${item?.id || 'new'}`;
  const accept = media.video ? [...IMAGE_TYPES, ...VIDEO_TYPES] : IMAGE_TYPES;

  // Free temporary preview blob URL when component unmounts or preview changes
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const chooseFile = e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (!accept.includes(file.type)) {
      setErrors({
        media: media.video
          ? 'Choose a JPEG, PNG, WebP, GIF, MP4 or WebM file.'
          : 'Choose a JPEG, PNG, WebP or GIF image.',
      });
      return;
    }

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setErrors({ media: `File is too big. The limit is ${MAX_UPLOAD_MB} MB.` });
      return;
    }

    setNewFile(file);
    setPreview(URL.createObjectURL(file));
    setCurrent(null);
    setErrors(prev => ({ ...prev, media: undefined }));
  };

  const removeMedia = () => {
    setNewFile(null);
    setPreview(null);
    setCurrent(null);
  };

  const update = key => e => {
    setValues(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    const found = {};

    if (media.required && !newFile && !current) {
      found.media = media.missing || 'Add an image first.';
    }

    for (const [key, cfg] of Object.entries(fields)) {
      if (cfg.required && !values[key]?.trim()) {
        found[key] = `${cfg.label} is required.`;
      }
    }

    if (fields.link && values.link.trim() && !youtubeId(values.link)) {
      found.link = 'Paste a valid YouTube video link.';
    }

    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      let stored = current;
      if (newFile) {
        const uploaded = await uploadFile(newFile, token);
        stored = { url: uploaded.url, type: uploaded.mediaType };
      }

      const body = {
        ...values,
        mediaUrl: stored?.url || null,
        mediaType: stored?.type || null,
      };

      const path = item
        ? `/api/collections/${collection.name}/${item.id}`
        : `/api/collections/${collection.name}`;

      const { ok, status, data } = await apiFetch(path, {
        method: item ? 'PUT' : 'POST',
        body,
        token,
      });

      if (!ok) {
        setErrors(data?.errors || {});
        setMessage(
          status === 401
            ? 'Your admin login has expired. Log in again.'
            : data?.message || 'Could not save.'
        );
        return;
      }

      collection.saved(data);
    } catch (err) {
      setMessage(
        err.message === 'Failed to fetch'
          ? 'Could not reach the server. Is it running?'
          : err.message
      );
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = preview || mediaSrc(current?.url);
  const previewType = newFile
    ? newFile.type.startsWith('video/')
      ? 'video'
      : 'image'
    : current?.type;

  const renderField = (key, cfg) => {
    const inputProps = {
      id: `${idPrefix}-${key}`,
      value: values[key],
      onChange: update(key),
      placeholder: cfg.placeholder,
    };

    return (
      <div key={key} className={`form-field ${errors[key] ? 'has-error' : ''}`}>
        <label htmlFor={inputProps.id}>
          {cfg.label}{' '}
          {cfg.required ? (
            <span className="required">*</span>
          ) : (
            <span className="optional">(optional)</span>
          )}
        </label>

        {key === 'text' ? (
          <textarea rows={cfg.rows || 4} maxLength={5000} {...inputProps} />
        ) : (
          <input
            type={key === 'link' ? 'url' : 'text'}
            maxLength={key === 'link' ? 300 : 120}
            {...inputProps}
          />
        )}

        {errors[key] && <span className="field-error">{errors[key]}</span>}
      </div>
    );
  };

  return (
    <div className="collection-editor">
      {heading && (
        <h4 className="collection-editor-heading">
          {item ? `Edit ${heading}` : `New ${heading}`}
        </h4>
      )}

      {previewUrl ? (
        <ItemMedia
          url={previewUrl}
          type={previewType}
          alt="Preview"
          className="work-media editor-preview"
        />
      ) : (
        <button
          type="button"
          className="work-media-empty"
          onClick={() => fileInput.current && fileInput.current.click()}
        >
          + {media.label}
        </button>
      )}

      <div className="photo-actions work-media-actions">
        <input
          ref={fileInput}
          type="file"
          accept={accept.join(',')}
          onChange={chooseFile}
          hidden
        />

        {previewUrl && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => fileInput.current && fileInput.current.click()}
            >
              Change
            </button>
            {!media.required && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={removeMedia}
              >
                Remove
              </button>
            )}
          </>
        )}

        {errors.media && <span className="field-error">{errors.media}</span>}
      </div>

      {Object.entries(fields).map(([key, cfg]) => renderField(key, cfg))}

      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? (newFile ? 'Uploading...' : 'Saving...') : 'Save'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => collection.setEditingId(null)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
