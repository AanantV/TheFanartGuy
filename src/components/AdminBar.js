import React, { useEffect, useState } from 'react';
import { useAdmin } from '../api';

// The admin login only appears when the address ends in #admin
// (e.g. https://aanantv.github.io/TheFanartGuy/#admin). Visitors never see it.
const isAdminHash = () => window.location.hash === '#admin';

function AdminBar() {
  const { isAdmin, login, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(isAdminHash);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onHashChange = () => setShowLogin(isAdminHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const closeLogin = () => {
    // Remove #admin from the address without reloading the page.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowLogin(false);
  };

  const handleLogin = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      await login(password);
      setPassword('');
      closeLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="admin-bar">
        <span className="admin-badge">Admin mode</span>
        <span className="admin-hint">Edit buttons are visible only to you.</span>
        <button type="button" className="btn btn-secondary btn-small" onClick={logout}>
          Log out
        </button>
      </div>
    );
  }

  if (!showLogin) return null;

  return (
    <form className="admin-bar" onSubmit={handleLogin}>
      <span className="admin-badge">Admin login</span>
      <label htmlFor="admin-password" className="visually-hidden">
        Admin password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        placeholder="Admin password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="btn btn-primary btn-small" disabled={busy}>
        {busy ? 'Checking...' : 'Login'}
      </button>
      <button type="button" className="btn btn-secondary btn-small" onClick={closeLogin}>
        Close
      </button>
      {error && <span className="field-error" role="alert">{error}</span>}
    </form>
  );
}

export default AdminBar;