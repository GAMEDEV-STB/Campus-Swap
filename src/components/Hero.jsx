import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HINTS, ACTIONS, PLACEHOLDERS } from '../constants';

export default function Hero({ onSearch }) {
  const { requireLogin, setPostModal } = useApp();
  const [mode, setMode] = useState('buy');
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'buy') {
      onSearch(query.trim());
      const browseEl = document.getElementById('browse');
      if (browseEl) {
        browseEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      const title = query.trim();
      requireLogin(() => {
        setPostModal({
          open: true,
          type: mode === 'lease' ? 'sell' : mode,
          category: mode === 'lease' ? 'Lease' : '',
          title
        });
      });
    }
  };

  return (
    <section className="hero">
      <h1>
        Your campus,
        <br />
        one big swap meet.
      </h1>
      <p className="lead">Buy, sell, swap or donate with students you can actually meet between classes.</p>

      <div className="modes" role="tablist" aria-label="What do you want to do?">
        {['buy', 'sell', 'swap', 'donate', 'request', 'lease'].map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <form className="searchbar" onSubmit={handleSubmit} role="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDERS[mode]}
          aria-label="Search listings"
        />
        <button className="btn btn-accent" type="submit">
          {ACTIONS[mode]}
        </button>
      </form>

      <p className="mode-hint" aria-live="polite">
        {HINTS[mode]}
      </p>
    </section>
  );
}
