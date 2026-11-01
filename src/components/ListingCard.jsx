import React from 'react';
import { useApp } from '../context/AppContext';
import {
  photosOf,
  isHeld,
  priceText,
  displayValue,
  starTxt,
  ratingOf
} from '../utils/helpers';
import { LABELS, COMPLETE_LABEL, DONE_LABEL, CONDS } from '../constants';

export default function ListingCard({ listing, isSaved }) {
  const {
    user,
    users,
    ratings,
    convos,
    requireLogin,
    toggleSave,
    deleteListing,
    setPostModal,
    setDoneModal,
    setDetailModal,
    setRateModal,
    setReportModal,
    claimDonate,
    openChatFor
  } = useApp();

  const isOwner = user && listing.owner === user.email;
  const isDone = listing.status === 'done';
  const busy = isHeld(listing);
  const photos = photosOf(listing);

  // Can the current user rate this listing?
  const canRate = () => {
    if (!user || !isDone) return false;
    const given = ratings.filter((r) => r.from === user.email && r.listingId === listing.id).map((r) => r.to);
    let targets = [];
    if (listing.owner === user.email) {
      if (listing.partner) targets = [listing.partner];
      else {
        targets = [...new Set(convos.filter((c) => c.listingId === listing.id).flatMap((c) => [c.buyer, c.seller]))].filter(
          (x) => x && x !== listing.owner
        );
      }
    } else if (
      listing.partner === user.email ||
      convos.some((c) => c.listingId === listing.id && (c.buyer === user.email || c.seller === user.email))
    ) {
      targets = [listing.owner];
    }
    return targets.some((t) => t && t !== user.email && !given.includes(t));
  };

  const canMessage =
    !isDone && !(busy && listing.reservedFor !== user?.email && listing.owner !== user?.email);

  const isInQueue =
    listing.type === 'donate' && (listing.claims || []).some((c) => user && c.u === user.email);

  const detailsLine = [
    displayValue(listing.category),
    displayValue(CONDS[listing.cond]),
    displayValue(listing.place),
    displayValue(listing.course)
  ]
    .filter(Boolean)
    .join(', ');

  const getOwnerName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  return (
    <article className={`card ${isDone ? 'done' : ''} ${busy ? 'held' : ''}`}>
      {photos.length > 0 && (
        <>
          <img
            className="cover"
            src={photos[0]}
            alt={`Photo of ${listing.title}`}
            loading="lazy"
            onClick={() => setDetailModal({ open: true, listingId: listing.id })}
          />
          {photos.length > 1 && <span className="more-badge">+{photos.length - 1}</span>}
        </>
      )}

      {!isOwner && !isDone && (
        <button
          className="heart"
          type="button"
          aria-pressed={isSaved}
          aria-label={(isSaved ? 'Remove from saved: ' : 'Save: ') + listing.title}
          onClick={() => toggleSave(listing.id)}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      )}

      <span className={`tag ${listing.type}`}>
        {isDone ? DONE_LABEL[listing.type] : busy ? 'Held' : LABELS[listing.type]}
      </span>

      {listing.bundle && <span className="tag bundle">Bundle</span>}
      {listing.course && <span className="tag course">{listing.course}</span>}

      <h3>
        <button
          type="button"
          className="title-btn"
          onClick={() => setDetailModal({ open: true, listingId: listing.id })}
        >
          {displayValue(listing.title)}
        </button>
      </h3>

      <p className="d">{displayValue(listing.desc)}</p>

      {detailsLine && <p>{detailsLine}</p>}

      {listing.owner && (
        <p className="by">
          by {getOwnerName(listing.owner)}, {starTxt(listing.owner, ratings)}
        </p>
      )}

      <div className="price">{priceText(listing)}</div>

      <div className="d-actions">
        {isOwner ? (
          <>
            <span className="mine">
              {isDone
                ? DONE_LABEL[listing.type] + ' ✓'
                : busy
                ? 'Held for ' + getOwnerName(listing.reservedFor)
                : listing.type === 'request'
                ? 'Your request'
                : 'Your listing'}
            </span>
            {!isDone && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost sm"
                  onClick={() => setPostModal({ open: true, type: listing.type, title: listing.title, editItem: listing })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost sm"
                  onClick={() => setDoneModal({ open: true, listing })}
                >
                  {COMPLETE_LABEL[listing.type]}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-danger sm"
              aria-label={(isDone ? 'Remove ' : 'Delete ') + listing.title}
              onClick={() => deleteListing(listing)}
            >
              {isDone ? 'Remove' : 'Delete'}
            </button>
          </>
        ) : canMessage ? (
          listing.type === 'donate' ? (
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => claimDonate(listing)}
            >
              {isInQueue ? 'In the queue' : 'Claim'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => openChatFor(listing)}
            >
              {listing.type === 'request' ? 'I have this' : 'Message seller'}
            </button>
          )
        ) : (
          <span className="mine">
            {isDone ? 'No longer available' : 'Held for someone else'}
          </span>
        )}

        {canRate() && (
          <button
            type="button"
            className="btn btn-accent sm"
            onClick={() => setRateModal({ open: true, listing })}
          >
            Leave a rating
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost sm"
          onClick={() => setDetailModal({ open: true, listingId: listing.id })}
        >
          Details
        </button>

        {!isOwner && (
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              requireLogin(() =>
                setReportModal({
                  open: true,
                  type: 'listing',
                  target: listing.id,
                  label: listing.title
                })
              )
            }
          >
            Report
          </button>
        )}
      </div>
    </article>
  );
}
