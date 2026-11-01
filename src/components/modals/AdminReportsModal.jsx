import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { supabase } from '../../lib/supabase';

export default function AdminReportsModal() {
  const { adminModal, setAdminModal, listings, setListings, users, setDetailModal, setProfileModal, toast } = useApp();
  const { isAdmin, loading: roleLoading, error: roleError } = useIsAdmin();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!adminModal.open || roleLoading || !isAdmin) return undefined;
    setLoading(true);
    setError('');
    supabase
      .from('reports')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(`Couldn't load reports: ${queryError.message}`);
        else setReports(data || []);
        setLoading(false);
      })
      .catch((queryError) => {
        if (!active) return;
        setError(`Couldn't load reports: ${queryError.message}`);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adminModal.open, isAdmin, roleLoading]);

  if (!adminModal.open) return null;

  const handleClose = () => setAdminModal({ open: false });

  const updateReportStatus = async (reportId, status) => {
    try {
      const { data, error: updateError } = await supabase
        .from('reports')
        .update({ status })
        .eq('id', reportId)
        .select('id');
      if (updateError) {
        setError(`Couldn't update report: ${updateError.message}`);
        return false;
      }
      if (!data?.length) {
        setError('The report was not updated. Confirm that your admin role is active.');
        return false;
      }
      setReports((current) => current.filter((report) => report.id !== reportId));
      return true;
    } catch (updateError) {
      setError(`Couldn't update report: ${updateError.message}`);
      return false;
    }
  };

  const handleRemoveListing = async (listingId, reportId) => {
    try {
      const { data, error: deleteError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId)
        .select('id');
      if (deleteError) {
        setError(`Couldn't remove listing: ${deleteError.message}`);
        return;
      }
      if (!data?.length) {
        setError('The listing was not deleted. Confirm that your admin role is active.');
        return;
      }
      setListings((current) => current.filter((listing) => listing.id !== listingId));
      await updateReportStatus(reportId, 'removed');
    } catch (deleteError) {
      setError(`Couldn't remove listing: ${deleteError.message}`);
    }
  };

  const openReports = reports.filter((report) => report.status === 'open');

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content wide" onClick={(event) => event.stopPropagation()}>
        <h2>Report queue</h2>
        {roleLoading && <p className="chat-note">Checking admin access…</p>}
        {roleError && <p className="err" role="alert">Couldn't verify admin access: {roleError}</p>}
        {!roleLoading && !roleError && !isAdmin && (
          <p className="err" role="alert">Admin access is required to view reports.</p>
        )}
        {isAdmin && loading && <p className="chat-note">Loading reports…</p>}
        {isAdmin && error && <p className="err" role="alert">{error}</p>}
        {isAdmin && !loading && !error && (
          <div>
            {openReports.length > 0 ? (
              openReports.map((report) => {
                const listing = report.target_type === 'listing'
                  ? listings.find((item) => item.id === report.target_id)
                  : null;
                const reporter = users.find((item) => item.id === report.reporter_id);
                const typePrefix = {
                  listing: 'Listing: ',
                  user: 'Student: ',
                  chat: 'Chat: '
                }[report.target_type] || '';

                return (
                  <div key={report.id} className="report">
                    <strong>{typePrefix}{report.target_label}</strong>
                    <p>{report.reason}{report.details ? ` – ${report.details}` : ''}</p>
                    <small>
                      Reported by {reporter?.name || 'Student'} on {new Date(report.created_at).toLocaleDateString()}
                    </small>
                    <div className="d-actions">
                      {listing && (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost sm"
                            onClick={() => {
                              handleClose();
                              setDetailModal({ open: true, listingId: listing.id });
                            }}
                          >
                            View listing
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger sm"
                            onClick={() => handleRemoveListing(listing.id, report.id)}
                          >
                            Remove listing
                          </button>
                        </>
                      )}
                      {report.target_type === 'user' && (
                        <button
                          type="button"
                          className="btn btn-ghost sm"
                          onClick={() => {
                            const target = users.find((item) => item.id === report.target_id);
                            if (!target) {
                              setError('The reported profile is no longer available.');
                              return;
                            }
                            handleClose();
                            setProfileModal({ open: true, email: target.email });
                          }}
                        >
                          View profile
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost sm"
                        onClick={() => updateReportStatus(report.id, 'resolved')}
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        className="btn btn-dark sm"
                        onClick={() => updateReportStatus(report.id, 'dismissed')}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="chat-note">No open reports.</p>
            )}
          </div>
        )}
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
