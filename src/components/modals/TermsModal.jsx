import React, { useEffect } from 'react';

export default function TermsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="terms-title">Terms &amp; Conditions</h2>
        <p>
          By creating an account or using Campus Swap, you agree to these terms.
          If you do not agree, do not use the service.
        </p>

        <h3>1. Who can use Campus Swap</h3>
        <p>
          Campus Swap is intended for students and members of the campus
          community. Keep your account details accurate, protect your login
          credentials, and do not impersonate another person or share your
          account.
        </p>

        <h3>2. Listings and prohibited items</h3>
        <p>
          You are responsible for the listings, photos, messages, and other
          content you submit. Be accurate about an item&apos;s condition, price,
          availability, and location, and only post items you are allowed to
          offer. Do not post weapons, alcohol, tobacco, vapes, drugs, stolen or
          counterfeit goods, pirated material, leaked exam material, or other
          unlawful or prohibited content.
        </p>

        <h3>3. Room and lease listings</h3>
        <p>
          For a room, lease, or sublet, make sure you have the right and any
          required permission to offer it. Clearly describe the rent, deposit,
          dates, occupancy, utilities, and relevant conditions. Users must
          independently verify the property, terms, identity of the other
          party, and any applicable housing rules or legal requirements before
          making an agreement or payment.
        </p>

        <h3>4. Transactions and safety</h3>
        <p>
          Campus Swap provides a place for users to connect; it does not own,
          inspect, sell, lease, or guarantee listed items or accommodations.
          You are responsible for evaluating offers and arranging transactions.
          Meet in a busy public place, inspect items before paying, and do not
          share sensitive personal or financial information in chat.
        </p>

        <h3>5. Respectful use and moderation</h3>
        <p>
          Do not use Campus Swap to scam, spam, harass, threaten, discriminate,
          or violate another person&apos;s rights. You may report concerning
          listings, chats, or profiles. Campus Swap may remove content or
          restrict accounts that violate these terms or put the community at
          risk.
        </p>

        <h3>6. Service availability and responsibility</h3>
        <p>
          Campus Swap is provided as available, without a guarantee that it will
          always be uninterrupted or error-free. To the extent permitted by law,
          Campus Swap is not responsible for disputes, losses, or damages
          arising from user content, communications, or transactions. Nothing
          in these terms limits rights that cannot legally be limited.
        </p>

        <h3>7. Changes and contact</h3>
        <p>
          These terms may be updated as the service changes. Continued use after
          an update means you accept the revised terms. For help or to report a
          concern, use the reporting tools available in the app.
        </p>

        <div className="actions" style={{ marginTop: '1.2rem' }}>
          <button type="button" className="btn btn-dark" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
