import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mediaSrc } from '../api';
import { AddItemButton, AdminItemControls, ItemEditor, useCollection } from './collection';

// Art Gallery: a "vision board" wall. Every poster keeps its own shape (tall,
// wide or square) and they pack into columns across the whole tab. Click one to
// see it full screen.

const FIELDS = {
  title: { label: 'Title', placeholder: 'Shown when visitors hover or open the poster' },
};

const MEDIA = {
  label: 'Choose poster image',
  video: false,
  required: true,
  missing: 'Choose a poster image first.',
};

const MIN_COLUMN_WIDTH = 240; // px; more columns appear as the screen gets wider
const MIN_COLUMN_WIDTH_PHONE = 130; // px; lets phones show 2 columns, like a pinboard
const GAP = 16; // px between posters

/** Watches an element's width (updates when the window or layout changes). */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!ref.current) return undefined;

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Masonry: puts each poster (in order) into whichever column is currently shortest,
 * using the image's own shape (height / width). Uses no more columns than there are
 * posters, so a small wall still spans the full width.
 */
function arrangeColumns(items, shapes, width) {
  const minWidth = width < 500 ? MIN_COLUMN_WIDTH_PHONE : MIN_COLUMN_WIDTH;
  const fit = Math.max(1, Math.floor((width + GAP) / (minWidth + GAP)));
  const count = Math.max(1, Math.min(fit, items.length || 1));
  const columns = Array.from({ length: count }, () => ({ height: 0, entries: [] }));

  items.forEach((item, index) => {
    const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a));
    shortest.entries.push({ item, index });
    shortest.height += shapes[item.id] || 1; // until the image loads, assume square
  });

  return columns.map(c => c.entries);
}

function Lightbox({ items, index, onClose, onStep }) {
  const item = items[index];

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onStep(1);
      if (e.key === 'ArrowLeft') onStep(-1);
    };

    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onStep]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || 'Poster'}
      onClick={onClose}
    >
      <figure className="lightbox-figure" onClick={e => e.stopPropagation()}>
        <img src={mediaSrc(item.mediaUrl)} alt={item.title || 'Poster'} />
        {item.title && <figcaption>{item.title}</figcaption>}
      </figure>

      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close" />

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-nav lightbox-prev"
            onClick={e => {
              e.stopPropagation();
              onStep(-1);
            }}
            aria-label="Previous poster"
          />
          <button
            type="button"
            className="lightbox-nav lightbox-next"
            onClick={e => {
              e.stopPropagation();
              onStep(1);
            }}
            aria-label="Next poster"
          />
        </>
      )}
    </div>
  );
}

function Gallery() {
  const gallery = useCollection('gallery');
  const { items, loaded, isAdmin, editingId, message } = gallery;

  const [open, setOpen] = useState(null); // index of the poster shown full screen
  const [shapes, setShapes] = useState({}); // item id -> height / width, learned as images load
  const [wallRef, wallWidth] = useWidth();

  const editingItem = items.find(i => i.id === editingId) || null;
  const columns = arrangeColumns(items, shapes, wallWidth);

  const learnShape = (id, img) => {
    if (!img.naturalWidth) return;
    const shape = img.naturalHeight / img.naturalWidth;
    setShapes(prev => (prev[id] === shape ? prev : { ...prev, [id]: shape }));
  };

  const step = delta =>
    setOpen(i => (i + delta + items.length) % items.length);

  return (
    <div className="gallery">
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}

      {/* The editor sits above the wall, since posters flow in columns. */}
      {editingId != null && (
        <div className="gallery-editor">
          <ItemEditor
            key={editingId}
            collection={gallery}
            item={editingId === 'new' ? null : editingItem}
            fields={FIELDS}
            media={MEDIA}
            heading="poster"
          />
        </div>
      )}

      {loaded && items.length === 0 && editingId === null && (
        <p className="admin-hint gallery-empty">
          {isAdmin
            ? 'Your wall is empty. Add your first poster below.'
            : 'The gallery is being curated. Check back soon!'}
        </p>
      )}

      <div className="gallery-wall" ref={wallRef} style={{ gap: GAP }}>
        {columns.map((entries, c) => (
          <div key={c} className="gallery-column" style={{ gap: GAP }}>
            {entries.map(({ item, index }) => (
              <figure
                key={item.id}
                className={`gallery-poster ${editingId === item.id ? 'is-editing' : ''}`}
              >
                <button
                  type="button"
                  className="gallery-open"
                  onClick={() => setOpen(index)}
                  aria-label={`Open ${item.title || 'poster'}`}
                >
                  <img
                    src={mediaSrc(item.mediaUrl)}
                    alt={item.title || 'Poster'}
                    onLoad={e => learnShape(item.id, e.currentTarget)}
                  />
                  {item.title && (
                    <figcaption className="gallery-caption">{item.title}</figcaption>
                  )}
                </button>

                {isAdmin && (
                  <AdminItemControls
                    collection={gallery}
                    item={item}
                    index={index}
                    vertical={false}
                  />
                )}
              </figure>
            ))}
          </div>
        ))}
      </div>

      <AddItemButton collection={gallery} label="Add poster" />

      {open !== null && items[open] && (
        <Lightbox
          items={items}
          index={open}
          onClose={() => setOpen(null)}
          onStep={step}
        />
      )}
    </div>
  );
}

export default Gallery;