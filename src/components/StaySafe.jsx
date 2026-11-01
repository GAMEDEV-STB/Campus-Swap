import React from 'react';
import { SPOTS, RULES } from '../constants';

export default function StaySafe() {
  return (
    <section id="safety" className="safety">
      <h2>Stay safe</h2>
      <p>
        Only students with a campus email can join. Meet in busy public places, inspect items before paying, and report anything that looks wrong.
      </p>

      <h3>Meet in public</h3>
      <p>
        Suggested spots: {SPOTS.join(', ')}. Go in daylight and tell a friend where you're going.
      </p>

      <h3>What you can't post</h3>
      <ul>
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <p>See something wrong? Use Report on any listing, chat or student profile.</p>
    </section>
  );
}
