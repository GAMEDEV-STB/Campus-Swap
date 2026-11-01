import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function RateModal() {
  const {
    rateModal,
    setRateModal,
    user,
    users,
    ratings,
    listings,
    convos,
    submitRating
  } = useApp();

  const [toEmail, setToEmail] = useState('');
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [targetOptions, setTargetOptions] = useState([]);

  const listing = rateModal.listing;

  useEffect(() => {
    if (!listing || !user) return;
    const given = ratings
      .filter((x) => x.from === user.email && x.listingId === listing.id)
      .map((x) => x.to);

    let t = [];
    if (listing.owner === user.email) {
      if (listing.partner) t = [listing.partner];
      else {
        t = [
          ...new Set(
            convos
              .filter((c) => c.listingId === listing.id)
              .flatMap((c) => [c.buyer, c.seller])
          )
        ].filter((x) => x && x !== listing.owner);
      }
    } else if (
      listing.partner === user.email ||
      convos.some(
        (c) =>
          c.listingId === listing.id &&
          (c.buyer === user.email || c.seller === user.email)
      )
    ) {
      t = [listing.owner];
    }
    if (listing.swapWith) {
      const o = listings.find((x) => x.id === listing.swapWith);
      if (o && o.owner !== user.email) t.push(o.owner);
    }
    const filtered = [...new Set(t)].filter((o) => o && o !== user.email && !given.includes(o));
    setTargetOptions(filtered);
    if (filtered.length > 0) {
      setToEmail(filtered[0]);
    }
    setStars(5);
    setText('');
  }, [listing, user, ratings, convos, listings, rateModal.open]);

  if (!rateModal.open || !listing) return null;

  const handleClose = () => {
    setRateModal({ open: false, listing: null });
  };

  const getStudentName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toEmail) return;
    const success = await submitRating(listing.id, toEmail, stars, text);
    if (success) handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Rate this exchange</h2>
        <form onSubmit={handleSubmit}>
          {targetOptions.length > 1 && (
            <label>
              Who are you rating?
              <select value={toEmail} onChange={(e) => setToEmail(e.target.value)}>
                {targetOptions.map((o) => (
                  <option key={o} value={o}>
                    {getStudentName(o)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>Rating, 5 is best</label>
          <div className="seg" role="radiogroup" aria-label="Rating, 5 is best">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n}>
                <input
                  type="radio"
                  name="stars"
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                />
                <span>{n}★</span>
              </label>
            ))}
          </div>

          <label>
            Comment (optional)
            <textarea
              rows={3}
              maxLength={200}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Skip
            </button>
            <button type="submit" className="btn btn-dark">
              Submit rating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
