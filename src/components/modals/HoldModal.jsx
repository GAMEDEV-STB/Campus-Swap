import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function HoldModal() {
  const {
    holdModal,
    setHoldModal,
    holdFor,
    convos,
    users
  } = useApp();

  const listing = holdModal.listing;
  const [whoEmail, setWhoEmail] = useState('');

  const chatterIds = listing
    ? [
        ...new Set(
          convos
            .filter((c) => c.listingId === listing.id)
            .flatMap((c) => [c.buyer, c.seller])
        )
      ].filter((x) => x && x !== listing.owner)
    : [];

  useEffect(() => {
    if (listing && chatterIds.length > 0) {
      setWhoEmail(listing.reservedFor || chatterIds[0]);
    }
  }, [listing, holdModal.open]);

  if (!holdModal.open || !listing) return null;

  const handleClose = () => {
    setHoldModal({ open: false, listing: null });
  };

  const getStudentName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!whoEmail) return;
    holdFor(listing, whoEmail);
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Hold for 24 hours</h2>
        <p className="desc">
          The item stays listed but only this student can message you about it until the hold ends.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Hold for
            <select value={whoEmail} onChange={(e) => setWhoEmail(e.target.value)}>
              {chatterIds.map((email) => (
                <option key={email} value={email}>
                  {getStudentName(email)}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark">
              Hold item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
