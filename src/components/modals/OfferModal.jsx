import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { uid, saveStorage } from '../../utils/helpers';

export default function OfferModal({ onSendOffer }) {
  const { offerModal, setOfferModal } = useApp();
  const [amount, setAmount] = useState('');

  if (!offerModal.open) return null;

  const handleClose = () => {
    setOfferModal({ open: false });
    setAmount('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val) return;
    onSendOffer(val);
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Make an offer</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Your offer (₹)
            <input
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-dark">
              Send offer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
