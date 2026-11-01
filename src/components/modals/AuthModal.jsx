import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { hasPasswordVariety } from '../../utils/helpers';

export default function AuthModal() {
  const {
    authModal,
    setAuthModal,
    signUp,
    signIn,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
    resendVerification
  } = useApp();

  const [mode, setMode] = useState(authModal.mode || 'login');
  const [providerSelected, setProviderSelected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [email, setEmail] = useState('');
  const [fullname, setFullname] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (authModal.open) {
      setMode(authModal.mode || 'login');
      setError('');
      setNote('');
    }
  }, [authModal.open, authModal.mode]);

  if (!authModal.open) return null;

  const handleClose = () => setAuthModal({ open: false, mode: 'login', afterLogin: null });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNote('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!hasPasswordVariety(password)) {
          throw new Error('Use at least three of: lowercase letters, uppercase letters, numbers, or symbols.');
        }
        await signUp(email, password, fullname);
        setVerificationPending(true);
        setMode('login');
        setNote('Check your email and verify your address before logging in or using Campus Swap.');
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setVerificationPending(false);
        setNote('If an account exists for that address, a password reset link has been sent.');
      } else if (mode === 'reset') {
        if (!hasPasswordVariety(password)) {
          throw new Error('Use at least three of: lowercase letters, uppercase letters, numbers, or symbols.');
        }
        await updatePassword(password);
      } else {
        await signIn(email, password);
        setVerificationPending(false);
        if (authModal.afterLogin) authModal.afterLogin();
      }
    } catch (submitError) {
      setError(submitError.message || 'Authentication failed.');
      if (/confirm|verif/i.test(submitError.message || '')) setVerificationPending(true);
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setNote('');
    try {
      await resendVerification(email);
      setNote('A new verification email has been sent.');
    } catch (resendError) {
      setError(resendError.message || "Couldn't resend the verification email.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(signInError.message || 'Google sign-in failed.');
      setBusy(false);
    }
  };

  const titles = {
    login: 'Log in',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password'
  };
  const submitButtons = {
    login: 'Log in',
    signup: 'Sign up',
    forgot: 'Send reset link',
    reset: 'Save new password'
  };
  const isChoosingProvider = mode === 'login' && !providerSelected;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h2>{titles[mode]}</h2>
        {isChoosingProvider ? (
          <div id="authProviders">
            <button
              type="button"
              className="auth-provider google-provider"
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.05 46.98 31.9 46.98 24.55Z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.91 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
              </svg>
              Continue with Google
            </button>
            {error && <p className="err" role="alert">{error}</p>}
            <div className="auth-divider"><span>or</span></div>
            <button
              type="button"
              className="auth-provider email-provider"
              onClick={() => {
                setProviderSelected(true);
                setError('');
              }}
            >
              Continue with email
            </button>
            <p className="auth-provider-note">
              Email verification is required.
            </p>
            <div className="actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'login' && verificationPending && (
              <button
                type="button"
                className="link-btn auth-back"
                onClick={() => setProviderSelected(false)}
              >
                ← Back to sign-in options
              </button>
            )}
            {mode === 'signup' && (
              <label>
                Full name
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={fullname}
                  onChange={(event) => setFullname(event.target.value)}
                  placeholder="Your Name"
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {mode !== 'forgot' && (
              <label>
                Password
                <span className="pw">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <p className="note">
                Use at least 6 characters and at least three types: lowercase, uppercase, numbers, or symbols.
              </p>
            )}
            {mode === 'login' && (
              <button
                type="button"
                className="link-btn"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setNote('');
                }}
              >
                Forgot password?
              </button>
            )}
            {note && (
              <div>
                <p className="note">{note}</p>
                {mode === 'login' && (
                  <button type="button" className="link-btn" onClick={handleResendVerification}>
                    Resend verification email
                  </button>
                )}
              </div>
            )}
            {error && <p className="err" role="alert">{error}</p>}
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
              <button type="submit" className="btn btn-dark" disabled={busy}>
                {busy ? 'Please wait…' : submitButtons[mode]}
              </button>
            </div>
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              {mode === 'signup' ? (
                <button type="button" className="link-btn" onClick={() => setMode('login')}>
                  Already have an account? Log in
                </button>
              ) : mode === 'login' ? (
                <button type="button" className="link-btn" onClick={() => {
                  setMode('signup');
                  setError('');
                  setNote('');
                }}>
                  New here? Create an account
                </button>
              ) : (
                <button type="button" className="link-btn" onClick={() => setMode('login')}>
                  Back to log in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
