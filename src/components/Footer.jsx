import React from 'react';

export default function Footer({ onOpenTerms }) {
  return (
    <footer>
      <span>Campus Swap</span>
      <span>Made by students, for students.</span>
      <button type="button" className="link-btn" onClick={onOpenTerms}>
        Terms &amp; Conditions
      </button>
    </footer>
  );
}
