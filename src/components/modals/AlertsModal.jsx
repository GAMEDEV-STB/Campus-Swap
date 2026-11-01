import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { saveStorage } from '../../utils/helpers';

export default function AlertsModal() {
  const {
    alertsModal,
    setAlertsModal,
    user,
    notifs,
    setNotifs,
    searches,
    setSearches,
    listings,
    setDetailModal
  } = useApp();

  useEffect(() => {
    if (alertsModal.open && user) {
      const updated = notifs.map((n) => (n.to === user.email ? { ...n, read: true } : n));
      setNotifs(updated);
      saveStorage('cs_notifs', updated);
    }
  }, [alertsModal.open, user]);

  if (!alertsModal.open || !user) return null;

  const handleClose = () => {
    setAlertsModal({ open: false });
  };

  const mineNotifs = notifs.filter((n) => n.to === user.email).reverse().slice(0, 30);
  const mySearches = searches.filter((s) => s.owner === user.email);

  const handleRemoveSearch = (searchId) => {
    const updated = searches.filter((s) => s.id !== searchId);
    setSearches(updated);
    saveStorage('cs_searches', updated);
  };

  const handleClickAlert = (listingId) => {
    handleClose();
    if (listings.some((l) => l.id === listingId)) {
      setDetailModal({ open: true, listingId });
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <h2>Alerts</h2>
        <div>
          {mineNotifs.length > 0 ? (
            mineNotifs.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`alert-row ${n.read ? '' : 'new'}`}
                onClick={() => handleClickAlert(n.listingId)}
              >
                <span>{n.text}</span>
                <small>
                  {new Date(n.t).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </small>
              </button>
            ))
          ) : (
            <p className="chat-note">
              No alerts yet. Save a search or post a request and we'll tell you when something matches.
            </p>
          )}
        </div>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.8rem' }}>Saved searches</h3>
        <div>
          {mySearches.length > 0 ? (
            mySearches.map((s) => (
              <div key={s.id} className="alert-row">
                <span>{s.label}</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => handleRemoveSearch(s.id)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="chat-note">No saved searches. Use “Save this search” under the filters.</p>
          )}
        </div>

        <div className="actions" style={{ marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
