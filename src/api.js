import React, { createContext, useContext, useEffect, useState } from 'react';

// Where the API server lives. Empty means "same site" (during development,
// webpack forwards /api to the server on port 4000). For the live site, set
// API_URL when building, e.g. API_URL=https://your-api.example.com npm run build
export const API_URL = process.env.API_URL || '';

const TOKEN_KEY = 'fanart-admin-token';

/** fetch() wrapper: adds the API address, JSON headers and the admin token if logged in. */
export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Uploads an image/video file (admin only). Resolves to { url, mediaType }. */
export async function uploadFile(file, token) {
  const res = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      Authorization: `Bearer ${token}`,
    },
    body: file,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Upload failed.');

  return data;
}

/** Turns a stored upload path (/api/uploads/...) into a full address for <img>/<video>. */
export const mediaSrc = url => (url && url.startsWith('/') ? `${API_URL}${url}` : url);

const AdminContext = createContext({ isAdmin: false, token: null });

/**
 * Keeps track of whether the site owner is logged in. The token is kept in sessionStorage,
 * so closing the browser tab logs you out.
 */
export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));

  // On page load, check that a saved token is still valid (e.g. server restarted).
  useEffect(() => {
    if (!token) return;

    apiFetch('/api/admin/session', { token })
      .then(({ data }) => {
        if (!data.admin) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async password => {
    const { ok, data } = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: { password },
    });

    if (!ok) throw new Error(data.message || 'Login failed.');

    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
  };

  const logout = async () => {
    await apiFetch('/api/admin/logout', { method: 'POST', token }).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <AdminContext.Provider value={{ isAdmin: Boolean(token), token, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}