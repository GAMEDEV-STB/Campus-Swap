import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { REASONS } from '../../constants';
import { supabase } from '../../lib/supabase';

export default function ReportModal() {
  const { reportModal, setReportModal, user, users, toast } = useApp();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!reportModal.open) return null;

  const handleClose = () => {
    setReportModal({ open: false, type: '', target: '', label: '' });
    setDetails('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.emailVerified) {
      setError('Verify your email before sending a report.');
      return;
    }

    const targetId = reportModal.type === 'user'
      ? users.find((profile) => profile.email === reportModal.target)?.id
      : reportModal.target;
    if (!targetId) {
      setError('The item you are reporting could not be found.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { error: submitError } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: reportModal.type,
        target_id: targetId,
        target_label: reportModal.label,
        reason,
        details: details.trim()
      });
      if (submitError) {
        setError(`Couldn't send report: ${submitError.message}`);
        return;
      }
      handleClose();
      toast('Report sent. An admin will review it.');
    } catch (submitError) {
      setError(`Couldn't send report: ${submitError.message}`);
    } finally {
      setBusy(false);
    }
  };

  const labelType = {
    listing: 'listing',
    user: 'student',
    chat: 'chat'
  }[reportModal.type] || 'item';

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h2>Report {labelType}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Reason
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Details (optional)
            <textarea
              rows={3}
              maxLength={240}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn btn-dark" disabled={busy}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
