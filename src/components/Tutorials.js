import React, { useState } from 'react';
import { mediaSrc } from '../api';
import { AddItemButton, AdminItemControls, ItemEditor, useCollection } from './collection';

// Tutorials: a thumbnail you upload (left) that turns into the YouTube video when
// clicked, with a banner (right) showing the title and description.

const FIELDS = {
  link: {
    label: 'YouTube link',
    required: true,
    placeholder: 'https://www.youtube.com/watch?v=... or https://youtu.be/...',
  },
  title: {
    label: 'Title',
    required: true,
    placeholder: 'e.g. Painting Spider-Man in comic style',
  },
  text: {
    label: 'Description',
    placeholder: 'What will viewers learn? Tools, brushes, steps...',
    rows: 5,
  },
};

const MEDIA = {
  label: 'Upload thumbnail image',
  video: false,
  required: true,
  missing: 'Upload a thumbnail image first.',
};

function TutorialPlayer({ tutorial }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    // youtube-nocookie.com: YouTube's privacy-enhanced mode (no tracking cookies until play).
    return (
      <div className="tutorial-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${tutorial.link}?autoplay=1&rel=0`}
          title={tutorial.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="tutorial-video tutorial-thumb"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${tutorial.title}`}
    >
      <img src={mediaSrc(tutorial.mediaUrl)} alt="" loading="lazy" />
      <span className="tutorial-play" aria-hidden="true">
        <svg viewBox="0 0 68 48">
          <path
            d="M66.5 7.7c-.8-2.9-3.1-5.2-6-6C55.2 0.5 34 0.5 34 0.5s-21.2 0-26.5 1.2c-2.9.8-5.2 3.1-6 6C0.3 13 0.3 24 0.3 24s0 11 1.2 16.3c.8 2.9 3.1 5.2 6 6C12.8 47.5 34 47.5 34 47.5s21.2 0 26.5-1.2c2.9-.8 5.2-3.1 6-6C67.7 35 67.7 24 67.7 24s0-11-1.2-16.3z"
            fill="#ff0000"
          />
          <path d="M27 34l18-10-18-10v20z" fill="#fff" />
        </svg>
      </span>
    </button>
  );
}

function Tutorials() {
  const tutorials = useCollection('tutorials');
  const { items, loaded, isAdmin, editingId, message } = tutorials;

  return (
    <div className="tutorials">
      <p>Learn how the art gets made: step-by-step videos, from first sketch to final colours.</p>

      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}

      {loaded && items.length === 0 && editingId == null && (
        <p className="admin-hint">
          {isAdmin
            ? 'No tutorials yet. Add your first one below.'
            : 'New tutorials are on the way. Check back soon!'}
        </p>
      )}

      <div className="tutorial-list">
        {items.map((tutorial, index) =>
          editingId === tutorial.id ? (
            <div key={tutorial.id} className="tutorial-card tutorial-card-editing">
              <ItemEditor
                collection={tutorials}
                item={tutorial}
                fields={FIELDS}
                media={MEDIA}
                heading="tutorial"
              />
            </div>
          ) : (
            <article key={tutorial.id} className="tutorial-card">
              <TutorialPlayer tutorial={tutorial} />
              <div className="tutorial-banner">
                <span className="tutorial-badge">Tutorial {index + 1}</span>
                <h3 className="tutorial-title">{tutorial.title}</h3>
                {tutorial.text && <p className="tutorial-text">{tutorial.text}</p>}
                <a
                  className="tutorial-youtube-link"
                  href={`https://www.youtube.com/watch?v=${tutorial.link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch on YouTube
                </a>
                {isAdmin && (
                  <AdminItemControls collection={tutorials} item={tutorial} index={index} />
                )}
              </div>
            </article>
          )
        )}

        {editingId === 'new' && (
          <div className="tutorial-card tutorial-card-editing">
            <ItemEditor
              collection={tutorials}
              item={null}
              fields={FIELDS}
              media={MEDIA}
              heading="tutorial"
            />
          </div>
        )}
      </div>

      <AddItemButton collection={tutorials} label="Add tutorial" />
    </div>
  );
}

export default Tutorials;