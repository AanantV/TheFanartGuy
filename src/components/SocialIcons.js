import React from 'react';

// Simple brand-style logos drawn as SVG, so they stay sharp at any size and
// need no extra downloads. They use "currentColor", so CSS sets their colour.

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1.5" y="5" width="21" height="14" rx="4.5" fill="currentColor" />
    <path d="M10 9 L15.5 12 L10 15 Z" fill="#fff" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" fill="currentColor" />
    <path
      d="M13.4 21.4V14h2.4l.4-2.9h-2.8V9.3c0-.8.3-1.4 1.4-1.4h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.8v2.1H8.1V14h2.4v7.4"
      fill="#fff"
    />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M3 6.5 L12 13 L21 6.5" />
  </svg>
);

export const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  facebook: FacebookIcon,
  gmail: MailIcon,
};