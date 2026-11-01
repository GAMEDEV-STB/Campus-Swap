import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  starTxt,
  ratingOf,
  doneCount,
  badgeList,
  priceText
} from '../../utils/helpers';

export default function UserProfileModal() {
  const {
    profileModal,
    setProfileModal,
    users,
    listings,
    ratings,
    blocks,
    user,
    requireLogin,
    toggleBlock,
    setReportModal,
    setDetailModal
  } = useApp();

  if (!profileModal.open || !profileModal.email) return null;

  const targetEmail = profileModal.email;
  const targetUser = users.find((x) => x.email === targetEmail);
  const targetName = targetUser ? targetUser.name : 'Student';

  const handleClose = () => {
    setProfileModal({ open: false, email: null });
  };

  const isSelf = user && user.email === targetEmail;
  const isBlockedByMe = user && blocks.some((b) => b.by === user.email && b.to === targetEmail);

  const r = ratingOf(targetEmail, ratings);
  const liveListings = listings.filter(
    (x) =>
      x.owner === targetEmail &&
      x.status !== 'done' &&
      !(user && x.owner !== user.email && blocks.some((b) => (b.by === user.email && b.to === x.owner) || (b.by === x.owner && b.to === user.email)))
  );

  const badges = badgeList(targetEmail, listings, ratings);

  const getListingTitle = (listingId) => {
    const l = listings.find((x) => x.id === listingId);
    return l ? l.title : 'Listing removed';
  };

  const getReviewerName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <div id="profileBody">
          <h2>{targetName}</h2>
          <p className="price">{starTxt(targetEmail, ratings)}</p>

          {badges.length > 0 && (
            <div className="badges">
              {badges.map((b) => (
                <span key={b} className="pill">
                  {b}
                </span>
              ))}
            </div>
          )}

          <p className="desc">
            {doneCount(targetEmail, listings)} completed exchanges, {liveListings.length} active listings
          </p>

          <div className="d-actions">
            {!isSelf && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost sm"
                  onClick={() =>
                    requireLogin(() => {
                      handleClose();
                      setReportModal({
                        open: true,
                        type: 'user',
                        target: targetEmail,
                        label: targetName
                      });
                    })
                  }
                >
                  Report student
                </button>
                <button
                  type="button"
                  className="btn btn-ghost sm"
                  onClick={() => toggleBlock(targetEmail)}
                >
                  {isBlockedByMe ? 'Unblock' : 'Block'}
                </button>
              </>
            )}
            <button type="button" className="btn btn-dark sm" onClick={handleClose}>
              Close
            </button>
          </div>

          <h3>Reviews</h3>
          {r.list.length > 0 ? (
            r.list
              .slice()
              .reverse()
              .map((rev) => (
                <div key={rev.id} className="review">
                  <strong>
                    {'★'.repeat(rev.stars)} {getReviewerName(rev.from)}
                  </strong>
                  {rev.text && <p>{rev.text}</p>}
                  <small>{getListingTitle(rev.listingId)}</small>
                </div>
              ))
          ) : (
            <p className="chat-note">No reviews yet.</p>
          )}

          {liveListings.length > 0 && (
            <section className="similar">
              <h3>Active listings</h3>
              <div>
                {liveListings.slice(0, 4).map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      handleClose();
                      setDetailModal({ open: true, listingId: x.id });
                    }}
                  >
                    <strong>{x.title}</strong>
                    <span>{priceText(x)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
