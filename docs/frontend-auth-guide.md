# Frontend Authentication Guide

Base URL: `http://localhost:5000/api/v1`

---

## How it works

The API uses two tokens:

| Token | Where it lives | Lifetime |
|---|---|---|
| **Access token** (JWT) | Your app's memory only | Short-lived (set by `JWT_EXPIRES_IN`) |
| **Refresh token** (JWT) | `httpOnly` cookie — browser handles it automatically | Long-lived (set by `JWT_REFRESH_EXPIRES_IN`) |

> **Never** store the access token in `localStorage` or `sessionStorage`. Keep it in memory (React state/context). The refresh token is unreachable by JavaScript by design.

---

## 1. Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "john.doe",
  "password": "secret"
}
```

**Success `200`**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "username": "john.doe",
    "role": "user",
    "groups": ["GroupA"]
  }
}
```

- Store `accessToken` in memory.
- The browser automatically receives and stores the `httpOnly` refresh cookie — you don't handle it.

**Errors**

| Status | Meaning |
|---|---|
| `400` | Missing / invalid fields |
| `401` | Wrong username or password |
| `429` | Too many attempts — wait and retry |

---

## 2. Authenticated requests

Attach the access token to every protected request:

```http
GET /users
Authorization: Bearer <accessToken>
```

```js
const res = await fetch(`${BASE_URL}/users`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

---

## 3. Token refresh

```http
POST /auth/refresh
```

### Input

| What | Details |
|---|---|
| **Request body** | Empty — nothing to send |
| **Headers** | None required |
| **Cookie** | The browser sends the `httpOnly` `refreshToken` cookie automatically as long as you include `credentials: "include"` in the fetch call. You never read or set this cookie yourself. |

```js
const res = await fetch(`${BASE_URL}/auth/refresh`, {
  method: "POST",
  credentials: "include", // REQUIRED — tells the browser to attach the httpOnly cookie
});
```

### Output

**Success `200`**
```json
{ "accessToken": "<new jwt>" }
```

Replace the old access token in memory with this value and reschedule the next refresh.

**Errors**

| Status | Meaning | What to do |
|---|---|---|
| `401` | Cookie missing | User never logged in — redirect to login |
| `401` | Refresh token expired | Session has ended — redirect to login |
| `401` | Refresh token revoked | User logged out elsewhere — redirect to login |

All three cases return `401`. If the refresh call itself returns `401`, treat it as a full session expiry: clear the access token from memory and send the user to the login page.

### When to call it

There are two complementary strategies — use both together:

**A — Reactive (on 401)**

Call refresh whenever any API request returns `401`. The access token has already expired.

```js
if (res.status === 401) {
  const { accessToken } = await silentRefresh(); // calls POST /auth/refresh
  // retry the original request with the new token
}
```

This is the safety net — it handles edge cases (server restart, clock skew, tab was suspended).

**B — Proactive (on a timer)**

Decode the `exp` claim from the JWT payload and schedule a refresh ~30 seconds before it expires, so the token is always valid when a request is made:

```js
function scheduleRefresh(accessToken) {
  const { exp } = JSON.parse(atob(accessToken.split(".")[1]));
  const msUntilExpiry = exp * 1000 - Date.now();
  const refreshAt = msUntilExpiry - 30_000; // 30 s before expiry

  if (refreshAt <= 0) {
    // already expired or nearly so — refresh immediately
    return doRefresh();
  }

  setTimeout(doRefresh, refreshAt);
}
```

Call `scheduleRefresh(accessToken)` immediately after login and after every successful refresh.

**C — On page load (silent refresh)**

When the user reopens the app their access token is gone (it was in memory), but the refresh cookie may still be valid. Attempt a refresh immediately on init to restore the session silently:

```js
async function init() {
  try {
    const { accessToken } = await doRefresh();
    setAccessToken(accessToken);
    scheduleRefresh(accessToken);
  } catch {
    setAccessToken(null); // refresh cookie expired — user must log in again
  }
}
```

---

## 4. Logout

Logout requires **both** the access token header (to authenticate the request) and `credentials: "include"` (to send the cookie so the server can revoke it):

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

```js
await fetch(`${BASE_URL}/auth/logout`, {
  method: "POST",
  credentials: "include",   // sends the httpOnly cookie for server-side revocation
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// Discard the access token from memory
setAccessToken(null);
```

**Success `200`**
```json
{ "message": "Logged out successfully" }
```

The server clears the refresh cookie and revokes the token. After this, any further refresh attempts will return `401`.

---

## 5. Get current user

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

**Success `200`**
```json
{
  "username": "john.doe",
  "role": "user",
  "groups": ["GroupA"]
}
```

Useful for restoring UI state after a token refresh on page load.

---

## Complete flow (React context sketch)

```js
// On app load: try a silent refresh — if it succeeds the user is still
// logged in (their refresh cookie is still valid).
async function init() {
  try {
    const { accessToken } = await silentRefresh();
    setAccessToken(accessToken);
    scheduleRefresh(accessToken);
  } catch {
    setAccessToken(null); // not logged in
  }
}

// Wrap every API call to handle 401 automatically.
async function apiFetch(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getAccessToken()}` },
  });

  if (res.status === 401) {
    try {
      const { accessToken } = await silentRefresh();
      setAccessToken(accessToken);
      scheduleRefresh(accessToken);
      // retry with the new token
      res = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      setAccessToken(null);
      redirectToLogin();
    }
  }

  return res;
}
```

---

## CORS note

The API only accepts requests from the origin configured in `CLIENT_URL` on the server (default `http://localhost:3000`). Make sure your dev server runs on that port, or ask the backend to update the env variable.
