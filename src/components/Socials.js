import React, { useState } from 'react';
import SOCIALS from '../data/socials';
import { SOCIAL_ICONS } from './SocialIcons';

function Socials() {
  const [copied, setCopied] = useState(false);
  const email = SOCIALS.find(s => s.id === 'gmail')?.handle;

  // Not everyone has an email app set up for mailto: links, so offer a copy button too.
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this email address:', email);
    }
  };

  return (
    <div className="socials">
      <header className="socials-hero">
        <h2 className="socials-title">Let&rsquo;s get social!</h2>
        <p className="socials-subtitle">
          Every sketch, speed-paint and finished piece lands here first. Follow along for sneak peeks and behind-the-scenes process, drop a comment, or just say hi. I read every message!
        </p>
      </header>

      <div className="socials-grid">
        {SOCIALS.map(social => {
          const Icon = SOCIAL_ICONS[social.id];
          const external = social.url.startsWith('http');

          // External links open in a new tab; "noopener noreferrer" stops the other site from controlling this page.
          const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

          return (
            <article key={social.id} className={`social-card social-${social.id}`}>
              <a
                className="social-icon"
                href={social.url}
                {...linkProps}
                aria-label={`${social.name}:${social.action}`}
              >
                {Icon && <Icon />}
              </a>

              <h3 className="social-name">{social.name}</h3>

              <a className="social-handle" href={social.url} {...linkProps}>
                {social.handle}
              </a>

              <p className="social-blurb">{social.blurb}</p>

              <div className="social-actions">
                <a className="btn social-button" href={social.url} {...linkProps}>
                  {Icon && <Icon />}
                  <span>{social.action}</span>
                </a>

                {social.id === 'gmail' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={copyEmail}
                  >
                    {copied ? 'Copied!' : 'Copy address'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default Socials;