import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { COMPLETE_LABEL } from '../../constants';

export default function DoneModal() {
  const {
    doneModal,
    setDoneModal,
    finishDone,
    users,
    convos,
    setRateModal
  } = useApp();

  const [partnerEmail, setPartnerEmail] = useState('');
  const listing = doneModal.listing;

  useEffect(() => {
    if (!listing) return;
    if (listing.reservedFor) {
      setPartnerEmail(listing.reservedFor);
    } else {
      setPartnerEmail('');
    }
  }, [listing, doneModal.open]);

  if (!doneModal.open || !listing) return null;

  const handleClose = () => {
    setDoneModal({ open: false, listing: null });
  };

  const chatterIds = [
    ...new Set(
      convos
        .filter((c) => c.listingId === listing.id)
        .flatMap((c) => [c.buyer, c.seller])
    )
  ].filter((x) => x && x !== listing.owner);

  const getStudentName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await finishDone(listing, partnerEmail);
    if (!success) return;
    handleClose();
    if (partnerEmail) {
      setRateModal({ open: true, listing: { ...listing, status: 'done', partner: partnerEmail } });
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{COMPLETE_LABEL[listing.type]}</h2>
        <p className="desc">
          Who did you deal with? They'll be able to rate you, and you'll be able to rate them.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Student
            <select
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
            >
              <option value="">Skip — don't attach a student</option>
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
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
