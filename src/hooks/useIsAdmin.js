import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export default function useIsAdmin() {
  const { user, authLoading } = useApp();
  const [status, setStatus] = useState({
    isAdmin: false,
    loading: true,
    error: ''
  });

  useEffect(() => {
    let active = true;

    if (authLoading) {
      setStatus({ isAdmin: false, loading: true, error: '' });
      return () => {
        active = false;
      };
    }

    if (!user || !user.emailVerified) {
      setStatus({ isAdmin: false, loading: false, error: '' });
      return () => {
        active = false;
      };
    }

    if (!supabase) {
      setStatus({ isAdmin: false, loading: false, error: 'Supabase is not configured.' });
      return () => {
        active = false;
      };
    }

    setStatus({ isAdmin: false, loading: true, error: '' });
    supabase
      .from('profiles')
      .select('role,email')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStatus({ isAdmin: false, loading: false, error: error.message });
          return;
        }
        setStatus({
          isAdmin:
            data?.role === 'admin' &&
            data.email.trim().toLowerCase() === user.email.trim().toLowerCase(),
          loading: false,
          error: ''
        });
      })
      .catch((queryError) => {
        if (active) {
          setStatus({ isAdmin: false, loading: false, error: queryError.message });
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, user?.emailVerified]);

  return status;
}
