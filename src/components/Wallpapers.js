import React from 'react';
import { mediaSrc } from '../api';
import { AddItemButton, AdminItemControls, ItemEditor, useCollection } from './collection';

// Two sources of wallpapers:
// 1. Built into the site: every image dropped into src/wallpapers/ (needs a rebuild).
// 2. Uploaded by the admin on this tab (stored on the server, appears instantly).

const context = require.context('../wallpapers', false, /\.(png|jpe?g|gif|svg|webp)$/i);

const builtin = context.keys().map(key => {
  const fileName = key.replace('./', '');
  return {
    key: `file-${fileName}`,
    title: fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
    src: context(key),
    downloadHref: context(key),
    downloadName: fileName,
  };
});

const FIELDS = {
  title: { label: 'Title', placeholder: 'e.g. Jailer Red' },
};

const MEDIA = {
  label: 'Choose wallpaper image',
  video: false,
  required: true,
  missing: 'Choose a wallpaper image first.',
};

// Uploaded files have random names on the server; ?download= asks the server to
// send them as a download called "<title>.<ext>" instead.
const uploadedDownloadHref = item =>
  `${mediaSrc(item.mediaUrl)}?download=${encodeURIComponent(item.title || 'TheFanartGuy wallpaper')}`;

function WallpaperCard({ title, src, downloadHref, downloadName, children }) {
  return (
    <figure className="wallpaper-card">
      <img src={src} alt={title} className="wallpaper-thumb" loading="lazy" />
      <figcaption className="wallpaper-caption">
        <span>{title}</span>
        <a href={downloadHref} download={downloadName || ''} className="download-button">
          Download
        </a>
      </figcaption>
      {children}
    </figure>
  );
}

function Wallpapers() {
  const uploads = useCollection('wallpapers');
  const { items, isAdmin, editingId, message } = uploads;
  const nothing = builtin.length === 0 && items.length === 0;

  return (
    <div>
      <p>Explore awesome fanart wallpapers here. Click Download to save one in full quality.</p>

      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}

      {nothing && editingId === null && <p>No wallpapers yet. Check back soon!</p>}

      <div className="wallpaper-grid">
        {builtin.map(w => (
          <WallpaperCard key={w.key} {...w} />
        ))}

        {items.map((item, index) =>
          editingId === item.id ? (
            <div key={item.id} className="wallpaper-editor">
              <ItemEditor
                collection={uploads}
                item={item}
                fields={FIELDS}
                media={MEDIA}
                heading="wallpaper"
              />
            </div>
          ) : (
            <WallpaperCard
              key={item.id}
              title={item.title || 'Wallpaper'}
              src={mediaSrc(item.mediaUrl)}
              downloadHref={uploadedDownloadHref(item)}
            >
              {isAdmin && (
                <AdminItemControls
                  collection={uploads}
                  item={item}
                  index={index}
                  vertical={false}
                />
              )}
            </WallpaperCard>
          )
        )}

        {editingId === 'new' && (
          <div className="wallpaper-editor">
            <ItemEditor
              collection={uploads}
              item={null}
              fields={FIELDS}
              media={MEDIA}
              heading="wallpaper"
            />
          </div>
        )}
      </div>

      <AddItemButton collection={uploads} label="Upload wallpaper" />

      {isAdmin && builtin.length > 0 && (
        <p className="admin-hint">
          Wallpapers built into the site (from <code>src/wallpapers/</code>) can&rsquo;t be edited
          here; only ones you upload.
        </p>
      )}
    </div>
  );
}

export default Wallpapers;