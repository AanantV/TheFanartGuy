import React from 'react';
import { mediaSrc } from '../api';
import { AddItemButton, AdminItemControls, ItemEditor, ItemMedia, useCollection } from './collection';

// "Standout works" on the About page: image or video on top, text below.

const FIELDS = {
  title: { label: 'Title' },
  text: {
    label: 'Text',
    placeholder: 'What makes this piece special? Tools, story, client...',
  },
};

const MEDIA = {
  label: 'Add image or video',
  video: true,
  required: false,
};

function Works() {
  const works = useCollection('works');
  const { items, isAdmin, editingId, message } = works;

  // Visitors don't see an empty section.
  if (!isAdmin && items.length === 0) return null;

  return (
    <section className="works">
      <h3 className="works-heading">Standout works</h3>
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}

      <div className="works-list">
        {items.map((work, index) =>
          editingId === work.id ? (
            <div key={work.id} className="work-card work-card-editing">
              <ItemEditor
                collection={works}
                item={work}
                fields={FIELDS}
                media={MEDIA}
              />
            </div>
          ) : (
            <article key={work.id} className="work-card">
              <ItemMedia
                url={mediaSrc(work.mediaUrl)}
                type={work.mediaType}
                alt={work.title || 'Work'}
              />
              {work.title && <h4 className="work-title">{work.title}</h4>}
              {work.text && <p className="work-text">{work.text}</p>}
              {isAdmin && (
                <AdminItemControls
                  collection={works}
                  item={work}
                  index={index}
                />
              )}
            </article>
          )
        )}

        {editingId === 'new' && (
          <div className="work-card work-card-editing">
            <ItemEditor
              collection={works}
              item={null}
              fields={FIELDS}
              media={MEDIA}
            />
          </div>
        )}
      </div>

      <AddItemButton collection={works} label="Add work" />

      {isAdmin && items.length === 0 && editingId === null && (
        <p className="admin-hint">
          No works yet. Visitors won&rsquo;t see this section until you add one.
        </p>
      )}
    </section>
  );
}

export default Works;