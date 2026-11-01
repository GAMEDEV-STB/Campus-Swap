import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  photosOf,
  isHeld,
  holdLabel,
  priceText,
  displayValue,
  starTxt,
  doneCount,
  badgeList
} from '../../utils/helpers';
import { LABELS, COMPLETE_LABEL, DONE_LABEL, CONDS } from '../../constants';

export default function ListingDetailModal() {
  const {
    detailModal,
    setDetailModal,
    listings,
    user,
    users,
    ratings,
    blocks,
    saved,
    convos,
    requireLogin,
    toggleSave,
    setPostModal,
    setDoneModal,
    setHoldModal,
    setRateModal,
    setProfileModal,
    setReportModal,
    clearHold,
    claimDonate,
    pickClaim,
    openChatFor
  } = useApp();

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  if (!detailModal.open || !detailModal.listingId) return null;

  const listing = listings.find((x) => x.id === detailModal.listingId);
  if (!listing) return null;

  const handleClose = () => {
    setDetailModal({ open: false, listingId: null });
    setActivePhotoIdx(0);
  };

  const isOwner = user && listing.owner === user.email;
  const isDone = listing.status === 'done';
  const busy = isHeld(listing);
  const photos = photosOf(listing);
  const isSaved = user && saved.some((s) => s.u === user.email && s.id === listing.id);

  const getStudentName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  // Chatter IDs for this listing
  const chatterIds = [
    ...new Set(
      convos
        .filter((c) => c.listingId === listing.id)
        .flatMap((c) => [c.buyer, c.seller])
    )
  ].filter((x) => x && x !== listing.owner);

  // Can rate check
  const canRate = () => {
    if (!user || !isDone) return false;
    const given = ratings
      .filter((r) => r.from === user.email && r.listingId === listing.id)
      .map((r) => r.to);
    let targets = [];
    if (listing.owner === user.email) {
      if (listing.partner) targets = [listing.partner];
      else targets = chatterIds;
    } else if (
      listing.partner === user.email ||
      convos.some(
        (c) =>
          c.listingId === listing.id &&
          (c.buyer === user.email || c.seller === user.email)
      )
    ) {
      targets = [listing.owner];
    }
    return targets.some((t) => t && t !== user.email && !given.includes(t));
  };

  const canMessage =
    !isDone && !(busy && listing.reservedFor !== user?.email && listing.owner !== user?.email);

  const isInQueue =
    listing.type === 'donate' &&
    (listing.claims || []).some((c) => user && c.u === user.email);

  // Facts
  const postedDate = !isNaN(parseInt(listing.id, 36))
    ? new Date(parseInt(listing.id, 36)).toLocaleDateString()
    : new Date().toLocaleDateString();

  const facts = [
    ['Category', displayValue(listing.category)],
    ['Condition', displayValue(CONDS[listing.cond])],
    ['Location', displayValue(listing.place)],
    ['Course code', displayValue(listing.course)],
    ['Bundle', listing.bundle ? 'Move-out / dorm kit' : ''],
    ['Hold', busy ? holdLabel(listing) + ' for ' + getStudentName(listing.reservedFor) : ''],
    ['Posted', postedDate]
  ].filter((x) => x[1]);

  // Similar listings
  const similar = listings
    .filter(
      (x) =>
        x.id !== listing.id &&
        x.status !== 'done' &&
        x.category === listing.category &&
        x.type === listing.type &&
        !(user && x.owner !== user.email && blocks.some((b) => (b.by === user.email && b.to === x.owner) || (b.by === x.owner && b.to === user.email)))
    )
    .slice(0, 3);

  const sellerBadges = badgeList(listing.owner, listings, ratings);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
        <div id="detailBody">
          {photos.length > 0 ? (
            <div className="gallery">
              <img
                className="g-main"
                src={photos[activePhotoIdx] || photos[0]}
                alt={`Photo of ${listing.title}`}
              />
              {photos.length > 1 && (
                <div className="g-thumbs">
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      className={activePhotoIdx === i ? 'active' : ''}
                      aria-label={`Show photo ${i + 1}`}
                      onClick={() => setActivePhotoIdx(i)}
                    >
                      <img src={p} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="g-none">No photo</div>
          )}

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className={`tag ${listing.type}`}>
              {isDone ? DONE_LABEL[listing.type] : busy ? 'Held' : LABELS[listing.type]}
            </span>
            {listing.bundle && <span className="tag bundle">Move-out bundle</span>}
            {listing.course && <span className="tag course">{listing.course}</span>}
          </div>

          <h2>{displayValue(listing.title)}</h2>
          <p className="price">{priceText(listing)}</p>

          {listing.desc && <p className="desc">{displayValue(listing.desc)}</p>}

          <dl className="facts">
            {facts.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </React.Fragment>
            ))}
          </dl>

          <div className="seller">
            <div>
              <strong>{getStudentName(listing.owner)}</strong>
              <span>
                {' '}
                {starTxt(listing.owner, ratings)}, {doneCount(listing.owner, listings)} completed
              </span>
              {sellerBadges.length > 0 && (
                <div className="badges">
                  {sellerBadges.map((b) => (
                    <span key={b} className="pill">
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost sm"
              onClick={() => setProfileModal({ open: true, email: listing.owner })}
            >
              View profile
            </button>
          </div>

          {/* Donation Queue for Owner */}
          {isOwner && listing.type === 'donate' && !isDone && (
            <section className="similar">
              <h3>Donation queue ({(listing.claims || []).length})</h3>
              {(listing.claims || []).length > 0 ? (
                <div>
                  {(listing.claims || []).map((c) => (
                    <div key={c.u} className="claim">
                      <strong>
                        {getStudentName(c.u)}
                        {c.picked ? ' · picked' : ''}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-dark sm"
                        hidden={busy && listing.reservedFor === c.u}
                        onClick={() => pickClaim(listing, c.u)}
                      >
                        Pick
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="chat-note">Nobody has claimed this yet.</p>
              )}
            </section>
          )}

          <div className="d-actions">
            {isOwner ? (
              <>
                <span className="mine">
                  {isDone
                    ? DONE_LABEL[listing.type]
                    : busy
                    ? 'Held for ' + getStudentName(listing.reservedFor)
                    : 'This is your listing'}
                </span>
                {!isDone && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => {
                        handleClose();
                        setPostModal({
                          open: true,
                          type: listing.type,
                          title: listing.title,
                          editItem: listing
                        });
                      }}
                    >
                      Edit listing
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => {
                        handleClose();
                        setDoneModal({ open: true, listing });
                      }}
                    >
                      {COMPLETE_LABEL[listing.type]}
                    </button>
                    {busy ? (
                      <button
                        type="button"
                        className="btn btn-ghost sm"
                        onClick={() => clearHold(listing)}
                      >
                        Release hold
                      </button>
                    ) : (
                      chatterIds.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost sm"
                          onClick={() => setHoldModal({ open: true, listing })}
                        >
                          Hold 24 hours
                        </button>
                      )
                    )}
                  </>
                )}
              </>
            ) : canMessage ? (
              <>
                {listing.type === 'donate' ? (
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => {
                      handleClose();
                      claimDonate(listing);
                    }}
                  >
                    {isInQueue ? 'In the queue' : 'Claim this free item'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => {
                      handleClose();
                      openChatFor(listing);
                    }}
                  >
                    {listing.type === 'request' ? 'I have this' : 'Message seller'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-pressed={isSaved}
                  onClick={() => toggleSave(listing.id)}
                >
                  {isSaved ? 'Saved ♥' : 'Save ♡'}
                </button>
              </>
            ) : (
              <span className="mine">
                {isDone ? 'No longer available' : 'Held for another student'}
              </span>
            )}

            {canRate() && (
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => {
                  handleClose();
                  setRateModal({ open: true, listing });
                }}
              >
                Leave a rating
              </button>
            )}

            {!isOwner && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  requireLogin(() => {
                    handleClose();
                    setReportModal({
                      open: true,
                      type: 'listing',
                      target: listing.id,
                      label: listing.title
                    });
                  })
                }
              >
                Report listing
              </button>
            )}

            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Close
            </button>
          </div>

          {similar.length > 0 && (
            <section className="similar">
              <h3>Similar listings</h3>
              <div>
                {similar.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setDetailModal({ open: true, listingId: x.id });
                      setActivePhotoIdx(0);
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
