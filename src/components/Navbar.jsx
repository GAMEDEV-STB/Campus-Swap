import React from 'react';
import { useApp } from '../context/AppContext';
import useIsAdmin from '../hooks/useIsAdmin';

export default function Navbar({ onWishlistToggle, isWishlistActive }) {
  const { isAdmin, loading: adminLoading, error: adminError } = useIsAdmin();
  const {
    user,
    logoutUser,
    requireLogin,
    setAuthModal,
    setPostModal,
    setIsChatOpen,
    setActiveChatId,
    convos,
    saved,
    notifs,
    setAlertsModal,
    setAdminModal
  } = useApp();

  // Unread chat messages for this user
  const unreadMessagesCount = user
    ? convos
        .filter((c) => (c.buyer === user.email || c.seller === user.email) && !(c.hidden && c.hidden[user.email]))
        .reduce((sum, c) => sum + (c.unread?.[user.email] || 0), 0)
    : 0;

  // Unread notifications
  const unreadAlertsCount = user ? notifs.filter((n) => n.to === user.email && !n.read).length : 0;

  const savedCount = user ? saved.filter((s) => s.u === user.email).length : 0;

  const handleOpenMessages = () => {
    requireLogin(() => {
      const myConvos = convos.filter(
        (c) => (c.buyer === user.email || c.seller === user.email) && !(c.hidden && c.hidden[user.email])
      );
      if (myConvos.length > 0) {
        setActiveChatId(myConvos[0].id);
      } else {
        setActiveChatId(null);
      }
      setIsChatOpen(true);
    });
  };

  return (
    <header className="nav">
      <a className="brand" href="#top" aria-label="Campus Swap home">
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <path
            d="M5 11h15l-4-4M23 17H8l4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Campus Swap
      </a>

      <nav>
        <a href="#browse">Browse</a>
        <a href="#how">How it works</a>
        <a href="#safety">Stay safe</a>
      </nav>

      {user && (
        <>
          <button
            type="button"
            className="btn btn-ghost nav-msg wishlist-nav"
            aria-pressed={isWishlistActive}
            onClick={onWishlistToggle}
          >
            {isWishlistActive ? 'All listings' : 'Wishlist'}
            {savedCount > 0 && <span className="badge">{savedCount}</span>}
          </button>

          <button
            type="button"
            className="btn btn-ghost nav-msg"
            onClick={() => setAlertsModal({ open: true })}
          >
            Alerts
            {unreadAlertsCount > 0 && <span className="badge">{unreadAlertsCount}</span>}
          </button>

          {isAdmin && (
            <button
              type="button"
              className="btn btn-ghost nav-msg"
              onClick={() => setAdminModal({ open: true })}
            >
              Reports
            </button>
          )}
          {user.emailVerified && adminLoading && <span className="chat-note">Checking admin access…</span>}
          {user.emailVerified && adminError && (
            <span className="err" role="status">Admin access unavailable</span>
          )}

          <button
            type="button"
            className="btn btn-ghost nav-msg"
            onClick={handleOpenMessages}
          >
            Messages
            {unreadMessagesCount > 0 && <span className="badge">{unreadMessagesCount}</span>}
          </button>

          <span className="who">Hi, {user.name.split(' ')[0]}</span>

          <button type="button" className="btn btn-ghost" onClick={logoutUser}>
            Log out
          </button>
        </>
      )}

      {!user && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setAuthModal({ open: true, mode: 'login' })}
        >
          Log in
        </button>
      )}

      <button
        type="button"
        className="btn btn-dark"
        onClick={() => requireLogin(() => setPostModal({ open: true, type: 'sell', title: '' }))}
      >
        Post a listing
      </button>
    </header>
  );
}
