import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  loadStorage,
  resizeImage
} from '../utils/helpers';
import { SPOTS, QUICK } from '../constants';
import OfferModal from './modals/OfferModal';
import SwapModal from './modals/SwapModal';

export default function ChatDrawer() {
  const {
    isChatOpen,
    setIsChatOpen,
    activeChatId,
    setActiveChatId,
    user,
    users,
    convos,
    setConvos,
    listings,
    blocks,
    holdFor,
    finishDone,
    toggleBlock,
    setProfileModal,
    setReportModal,
    setDetailModal,
    setOfferModal,
    setSwapModal,
    toast
  } = useApp();

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [replyTo, setReplyTo] = useState(null);
  const [msgInput, setMsgInput] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { count, canAll, onConfirm }
  const [typingText, setTypingText] = useState('');

  const bodyRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const activeConvo = convos.find(
    (c) => c.id === activeChatId && (c.buyer === user?.email || c.seller === user?.email)
  );

  const otherEmail = activeConvo
    ? activeConvo.buyer === user?.email
      ? activeConvo.seller
      : activeConvo.buyer
    : null;

  const isOtherBlocked = Boolean(
    user &&
      otherEmail &&
      blocks.some(
        (b) =>
          (b.by === user.email && b.to === otherEmail) ||
          (b.by === otherEmail && b.to === user.email)
      )
  );

  const isBlockedByMe = Boolean(
    user && otherEmail && blocks.some((b) => b.by === user.email && b.to === otherEmail)
  );

  const convoListing = activeConvo
    ? listings.find((x) => x.id === activeConvo.listingId)
    : null;

  const getStudentName = (email) => {
    const u = users.find((x) => x.email === email);
    return u ? u.name : 'Student';
  };

  const mid = (m) => m.id || `${m.from}|${m.t}`;

  // Visible messages (not deleted for current user or cleared)
  const visibleMessages = activeConvo
    ? activeConvo.messages.filter((m) => {
        const clearedTime = activeConvo.cleared?.[user?.email] || 0;
        if (m.t <= clearedTime) return false;
        if (m.delFor && m.delFor.includes(user?.email)) return false;
        return true;
      })
    : [];

  // Scroll to bottom on message updates
  useEffect(() => {
    if (bodyRef.current && !selecting) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [visibleMessages.length, activeChatId, selecting]);

  // Mark unread as 0 and update readAt when active convo is open
  useEffect(() => {
    if (isChatOpen && activeConvo && user) {
      if (activeConvo.unread?.[user.email]) {
        const updated = convos.map((c) =>
          c.id === activeConvo.id
            ? {
                ...c,
                unread: { ...c.unread, [user.email]: 0 },
                readAt: { ...(c.readAt || {}), [user.email]: Date.now() }
              }
            : c
        );
        setConvos(updated);
      }
    }
  }, [isChatOpen, activeChatId, user]);

  // Typing watcher interval
  useEffect(() => {
    if (!isChatOpen || !activeConvo || !user) return;
    const interval = setInterval(() => {
      const allTyping = loadStorage('cs_typing', {});
      const cTyping = allTyping[activeConvo.id] || {};
      const now = Date.now();
      const activeTypers = Object.entries(cTyping)
        .filter(([u, ts]) => u !== user.email && now - ts < 2500)
        .map(([u]) => getStudentName(u));

      if (activeTypers.length > 0) {
        setTypingText(`${activeTypers[0].split(' ')[0]} is typing…`);
      } else {
        setTypingText('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isChatOpen, activeConvo, user, users]);

  // Keyboard close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isChatOpen) {
        if (selecting) {
          setSelecting(false);
          setSelectedIds(new Set());
        } else {
          setIsChatOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, selecting]);

  if (!isChatOpen) return null;

  const handleClose = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setReplyTo(null);
    setIsChatOpen(false);
  };

  const handleTypingInput = (e) => {
    setMsgInput(e.target.value);
    if (!activeConvo || !user) return;
    const t = loadStorage('cs_typing', {});
    t[activeConvo.id] = t[activeConvo.id] || {};
    t[activeConvo.id][user.email] = Date.now();
    saveStorage('cs_typing', t);

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      const cur = loadStorage('cs_typing', {});
      if (cur[activeConvo.id]) {
        delete cur[activeConvo.id][user.email];
        saveStorage('cs_typing', cur);
      }
    }, 1200);
  };

  const pushMessage = (extra) => {
    if (!activeConvo || !user) return;
    const newMsg = {
      id: crypto.randomUUID(),
      from: user.email,
      t: Date.now(),
      text: extra.text || '',
      ...extra
    };
    const other = otherEmail;
    const updated = convos.map((c) => {
      if (c.id === activeConvo.id) {
        return {
          ...c,
          messages: [...c.messages, newMsg],
          unread: {
            ...c.unread,
            [other]: (c.unread?.[other] || 0) + 1
          },
          hidden: {
            ...c.hidden,
            [other]: false
          }
        };
      }
      return c;
    });
    setConvos(updated);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!msgInput.trim() || !activeConvo || !user || isOtherBlocked) return;
    pushMessage({
      text: msgInput.trim(),
      reply: replyTo ? { id: replyTo.id, from: replyTo.from, text: replyTo.text } : undefined
    });
    setMsgInput('');
    setReplyTo(null);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !activeConvo || isOtherBlocked) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      toast('Choose an image under 10 MB');
      return;
    }
    try {
      const photo = await resizeImage(file);
      pushMessage({ text: msgInput.trim(), photo });
      setMsgInput('');
    } catch {
      toast("Couldn't send that photo");
    }
  };

  const handleDeleteChat = () => {
    if (!activeConvo || !user) return;
    if (
      !window.confirm(
        `Delete this chat? It disappears from your messages, and ${getStudentName(
          otherEmail
        )} keeps their own copy.`
      )
    ) {
      return;
    }
    const updated = convos
      .map((c) => {
        if (c.id === activeConvo.id) {
          const newHidden = { ...(c.hidden || {}), [user.email]: true };
          const newCleared = { ...(c.cleared || {}), [user.email]: Date.now() };
          const newUnread = { ...(c.unread || {}), [user.email]: 0 };
          return { ...c, hidden: newHidden, cleared: newCleared, unread: newUnread };
        }
        return c;
      });

    setConvos(updated);
    setActiveChatId(null);
    toast('Chat deleted');
  };

  // Message selection
  const toggleSelectId = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCopySelected = async () => {
    const chosen = visibleMessages.filter((m) => selectedIds.has(mid(m)) && !m.deleted);
    if (!chosen.length) return;
    const text =
      chosen.length === 1
        ? chosen[0].text
        : chosen
            .map((m) => (m.from === user.email ? 'You' : getStudentName(m.from)) + ': ' + m.text)
            .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch {
      toast("Couldn't copy");
    }
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const handleReplySelected = () => {
    const chosen = visibleMessages.find((m) => selectedIds.has(mid(m)) && !m.deleted);
    if (!chosen) return;
    setReplyTo({ id: mid(chosen), from: chosen.from, text: chosen.text.slice(0, 120) });
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    const chosen = visibleMessages.filter((m) => selectedIds.has(mid(m)));
    if (!chosen.length) return;
    const canAll = chosen.every((m) => m.from === user.email && !m.deleted);
    setDeleteConfirmModal({
      count: chosen.length,
      canAll,
      onConfirm: (choice) => {
        if (!choice) return;
        const updated = convos.map((c) => {
          if (c.id === activeConvo.id) {
            const nextMsgs = c.messages.map((m) => {
              if (selectedIds.has(mid(m))) {
                if (choice === 'all') {
                  return { ...m, deleted: true, text: '' };
                } else {
                  return { ...m, delFor: (m.delFor || []).concat(user.email) };
                }
              }
              return m;
            });
            return { ...c, messages: nextMsgs };
          }
          return c;
        });
        setConvos(updated);
        setSelecting(false);
        setSelectedIds(new Set());
        toast(choice === 'all' ? 'Deleted for everyone' : 'Deleted for you');
      }
    });
  };

  // Deal Offer / Swap handlers
  const handleOfferResponse = (msg, status) => {
    if (!activeConvo) return;
    const updated = convos.map((c) => {
      if (c.id === activeConvo.id) {
        const nextMsgs = c.messages.map((m) => {
          if (m.id === msg.id && m.offer) {
            return { ...m, offer: { ...m.offer, status } };
          }
          return m;
        });
        return { ...c, messages: nextMsgs };
      }
      return c;
    });
    setConvos(updated);

    if (status === 'accepted' && convoListing && convoListing.owner === user.email && convoListing.type === 'sell') {
      holdFor(convoListing, otherEmail);
    }
    pushMessage({
      text: status === 'accepted' ? `Offer of ₹${msg.offer.amount} accepted` : `Offer of ₹${msg.offer.amount} declined`
    });
  };

  const handleSwapResponse = (msg, status) => {
    if (!activeConvo) return;
    const updated = convos.map((c) => {
      if (c.id === activeConvo.id) {
        const nextMsgs = c.messages.map((m) => {
          if (m.id === msg.id && m.swap) {
            return { ...m, swap: { ...m.swap, status } };
          }
          return m;
        });
        return { ...c, messages: nextMsgs };
      }
      return c;
    });
    setConvos(updated);

    if (status === 'accepted') {
      const a = convoListing;
      const b = listings.find((x) => x.id === msg.swap.listingId);
      if (a && b) {
        finishDone(a.owner === user.email ? a : b, otherEmail);
      }
    } else {
      pushMessage({ text: 'Swap proposal declined' });
    }
  };

  const jumpToMessage = (mId) => {
    const el = document.getElementById(`m-${mId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    } else {
      toast("Original message isn't visible");
    }
  };

  const myConvos = user
    ? convos
        .filter((c) => (c.buyer === user.email || c.seller === user.email) && !(c.hidden && c.hidden[user.email]))
        .sort((a, b) => {
          const lastA = a.messages.length ? a.messages[a.messages.length - 1].t : 0;
          const lastB = b.messages.length ? b.messages[b.messages.length - 1].t : 0;
          return lastB - lastA;
        })
    : [];

  const lastMineMsg = [...visibleMessages].reverse().find((m) => m.from === user.email && !m.deleted);

  return (
    <>
      <aside id="chat" className="open" role="dialog" aria-label="Messages">
        {/* Inbox Left Pane */}
        <div className={`chat-inbox ${activeChatId ? 'has-active' : ''}`}>
          <div className="chat-top">
            <h2>Messages</h2>
            <button className="btn btn-ghost" onClick={handleClose} aria-label="Close messages">
              Close
            </button>
          </div>

          <ul id="convoList">
            {myConvos.map((c) => {
              const other = c.buyer === user.email ? c.seller : c.buyer;
              const unreadN = c.unread?.[user.email] || 0;
              const vMsgs = c.messages.filter((m) => {
                const clearedTime = c.cleared?.[user.email] || 0;
                if (m.t <= clearedTime) return false;
                if (m.delFor && m.delFor.includes(user.email)) return false;
                return true;
              });
              const lastMsg = vMsgs[vMsgs.length - 1];

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={c.id === activeChatId}
                    onClick={() => {
                      setActiveChatId(c.id);
                      setSelecting(false);
                      setSelectedIds(new Set());
                      setReplyTo(null);
                    }}
                  >
                    <strong>
                      <span>{c.title}</span>
                      {unreadN > 0 && <span className="badge">{unreadN}</span>}
                    </strong>
                    <small>
                      {getStudentName(other)}
                      {lastMsg ? ` · ${lastMsg.deleted ? 'This message was deleted' : lastMsg.text}` : ''}
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>

          {myConvos.length === 0 && (
            <p className="chat-note">
              No conversations yet. Choose "Message seller" on a listing to start one.
            </p>
          )}
        </div>

        {/* Thread Right Pane */}
        <div className={`chat-thread ${!activeChatId ? 'has-no-active' : ''}`}>
          {activeConvo ? (
            <>
              {selecting ? (
                <div className="thread-head">
                  <div>
                    <strong>{selectedIds.size} selected</strong>
                    <span>Tap messages to select more</span>
                  </div>
                  <div className="head-actions">
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      disabled={!selectedIds.size}
                      onClick={handleCopySelected}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      disabled={selectedIds.size !== 1}
                      onClick={handleReplySelected}
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger sm"
                      disabled={!selectedIds.size}
                      onClick={handleDeleteSelected}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => {
                        setSelecting(false);
                        setSelectedIds(new Set());
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="thread-head">
                  <div>
                    <strong>{activeConvo.title}</strong>
                    <span>Chatting with {getStudentName(otherEmail)}</span>
                  </div>
                  <div className="head-actions">
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => {
                        setSelecting(true);
                        setSelectedIds(new Set());
                      }}
                    >
                      Select
                    </button>
                    <button type="button" className="btn btn-danger sm" onClick={handleDeleteChat}>
                      Delete chat
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => setActiveChatId(null)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {!selecting && (
                <div className="thread-safe">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setProfileModal({ open: true, email: otherEmail })}
                  >
                    View {getStudentName(otherEmail)}'s profile
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      setReportModal({
                        open: true,
                        type: 'chat',
                        target: activeConvo.id,
                        label: `${activeConvo.title} with ${getStudentName(otherEmail)}`
                      })
                    }
                  >
                    Report chat
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => toggleBlock(otherEmail)}
                  >
                    {isBlockedByMe ? 'Unblock' : 'Block'}
                  </button>
                  {convoListing && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setDetailModal({ open: true, listingId: convoListing.id })}
                    >
                      View listing
                    </button>
                  )}
                </div>
              )}

              <div className="thread-body" ref={bodyRef}>
                {visibleMessages.length === 0 ? (
                  <p className="chat-note">
                    Say hello and agree on a public meeting spot on campus.
                  </p>
                ) : (
                  visibleMessages.map((m) => {
                    const id = mid(m);
                    const isMe = m.from === user.email;
                    const isPicked = selectedIds.has(id);
                    const isDeleted = Boolean(m.deleted);

                    return (
                      <div
                        key={id}
                        id={`m-${id}`}
                        className={`bubble ${isMe ? 'me' : ''} ${isDeleted ? 'gone' : ''} ${
                          isPicked ? 'picked' : ''
                        }`}
                        role={selecting ? 'checkbox' : undefined}
                        aria-checked={selecting ? isPicked : undefined}
                        onClick={() => {
                          if (selecting) toggleSelectId(id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelecting(true);
                          toggleSelectId(id);
                        }}
                      >
                        {m.reply && !isDeleted && (
                          <div
                            className="quote jump"
                            title="Jump to original"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              jumpToMessage(m.reply.id);
                            }}
                          >
                            <b>{m.reply.from === user.email ? 'You' : getStudentName(m.reply.from)}</b>
                            <span>{m.reply.text}</span>
                          </div>
                        )}

                        {m.photo && !isDeleted && (
                          <img className="chat-pic" src={m.photo} alt="Photo in chat" />
                        )}

                        {isDeleted ? '🚫 This message was deleted' : m.text}

                        {m.offer && !isDeleted && (
                          <div className="deal-status">
                            {m.offer.status === 'pending' && !isMe ? (
                              <div className="d-actions">
                                <button
                                  type="button"
                                  className="btn btn-dark sm"
                                  onClick={() => handleOfferResponse(m, 'accepted')}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost sm"
                                  onClick={() => handleOfferResponse(m, 'declined')}
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <small>
                                {m.offer.status === 'pending'
                                  ? 'Waiting for a reply'
                                  : m.offer.status.charAt(0).toUpperCase() + m.offer.status.slice(1)}
                              </small>
                            )}
                          </div>
                        )}

                        {m.swap && !isDeleted && (
                          <div className="deal-status">
                            {m.swap.status === 'pending' && !isMe ? (
                              <div className="d-actions">
                                <button
                                  type="button"
                                  className="btn btn-dark sm"
                                  onClick={() => handleSwapResponse(m, 'accepted')}
                                >
                                  Accept swap
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost sm"
                                  onClick={() => handleSwapResponse(m, 'declined')}
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <small>
                                {m.swap.status === 'pending'
                                  ? `Waiting · ${m.swap.title}`
                                  : `${m.swap.title} · ${m.swap.status}`}
                              </small>
                            )}
                          </div>
                        )}

                        <time>
                          {new Date(m.t).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>

                        {isMe &&
                          lastMineMsg &&
                          lastMineMsg.id === m.id &&
                          activeConvo.readAt &&
                          activeConvo.readAt[otherEmail] > m.t && (
                            <span className="seen">Seen</span>
                          )}
                      </div>
                    );
                  })
                )}
              </div>

              {replyTo && !selecting && (
                <div className="reply-bar">
                  <div>
                    <strong>
                      Replying to {replyTo.from === user.email ? 'yourself' : getStudentName(replyTo.from)}
                    </strong>
                    <span>{replyTo.text}</span>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                    ✕
                  </button>
                </div>
              )}

              {!isOtherBlocked && !selecting && (
                <div className="chat-tools">
                  <div className="spots">
                    <span>Suggest a public spot:</span>
                    {SPOTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="chip"
                        onClick={() => setMsgInput(`Can we meet at ${s}?`)}
                      >
                        {s.replace(/^the /, '')}
                      </button>
                    ))}
                  </div>

                  <div className="spots">
                    <span>Quick reply:</span>
                    {QUICK.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="chip"
                        onClick={() => setMsgInput(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="deal-row">
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => setOfferModal({ open: true })}
                    >
                      Make an offer
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost sm"
                      onClick={() => setSwapModal({ open: true })}
                    >
                      Propose a swap
                    </button>
                    <label className="chat-photo-btn">
                      Photo
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  </div>

                  {typingText && <p className="typing">{typingText}</p>}
                </div>
              )}

              {!selecting && (
                <form className="msg-form" onSubmit={handleSendMessage}>
                  <input
                    disabled={isOtherBlocked}
                    placeholder={
                      isOtherBlocked
                        ? 'Messaging is turned off for this chat'
                        : 'Write a message'
                    }
                    maxLength={500}
                    value={msgInput}
                    onChange={handleTypingInput}
                  />
                  <button className="btn btn-accent" type="submit" disabled={isOtherBlocked}>
                    Send
                  </button>
                </form>
              )}
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="chat-top">
                <h2>Select a conversation</h2>
                <button className="btn btn-ghost" onClick={handleClose}>
                  Close
                </button>
              </div>
              <p className="chat-note">Choose a student from the inbox on the left to start chatting.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Delete Messages Modal */}
      {deleteConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Delete {deleteConfirmModal.count === 1 ? 'message' : `${deleteConfirmModal.count} messages`}?</h2>
            <p className="desc" style={{ marginBottom: '1rem' }}>
              Deleting for everyone shows "This message was deleted" to both of you.
            </p>
            <div className="actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
              {deleteConfirmModal.canAll && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    deleteConfirmModal.onConfirm('all');
                    setDeleteConfirmModal(null);
                  }}
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => {
                  deleteConfirmModal.onConfirm('me');
                  setDeleteConfirmModal(null);
                }}
              >
                Delete for me
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirmModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      <OfferModal
        onSendOffer={(amt) => {
          pushMessage({ text: `Offer: ₹${amt}`, offer: { amount: amt, status: 'pending' } });
          toast('Offer sent');
        }}
      />

      {/* Swap Modal */}
      <SwapModal
        currentListingId={convoListing?.id}
        onSendSwap={(lId, lTitle) => {
          pushMessage({
            text: `Swap proposal: ${lTitle}`,
            swap: { listingId: lId, title: lTitle, status: 'pending' }
          });
          toast('Swap proposal sent');
        }}
      />
    </>
  );
}
