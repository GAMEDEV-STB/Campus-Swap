import React from 'react';
import { useApp } from '../../context/AppContext';
import { priceText, isHeld } from '../../utils/helpers';

export default function SwapModal({ onSendSwap, currentListingId }) {
  const { swapModal, setSwapModal, listings, user } = useApp();

  if (!swapModal.open || !user) return null;

  const handleClose = () => {
    setSwapModal({ open: false });
  };

  const myListings = listings.filter(
    (x) => x.owner === user.email && x.status !== 'done' && !isHeld(x) && x.id !== currentListingId
  );

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <h2>Propose a swap</h2>
        <p className="desc">
          Attach one of your listings. If they accept, both items are marked swapped together.
        </p>
        <div>
          {myListings.length > 0 ? (
            myListings.map((l) => (
              <button
                key={l.id}
                type="button"
                className="alert-row"
                onClick={() => {
                  onSendSwap(l.id, l.title);
                  handleClose();
                }}
              >
                <strong>{l.title}</strong>
                <small>{priceText(l)}</small>
              </button>
            ))
          ) : (
            <p className="chat-note">
              You need an active listing of your own to propose a swap.
            </p>
          )}
        </div>
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
