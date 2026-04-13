# Frontend Authentication Guide

> Last updated: April 2026

Base URL: `http://localhost:5000/api/v1`

---

## Overview

The API uses a **dual-token** strategy:

| Token | Transport | Storage | Lifetime |
|---|---|---|---|
| **Access token** (JWT) | JSON response body | **In-memory only** (React state / context / variable) | Short — configured via `JWT_EXPIRES_IN` (e.g. `15m`) |
| **Refresh token** (JWT) | `HttpOnly` cookie named `refreshToken` | **Managed by the browser** — scoped to path `/api/v1/auth` | Long — configured via `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`) |

### Token storage rules

| Do | Don't |
|---|---|
| Keep the access token in a JS variable / React ref / Zustand / Context | Store the access token in `localStorage` or `sessionStorage` (XSS vulnerable) |
| Let the browser manage the refresh cookie automatically | Try to read, set, or delete the `refreshToken` cookie from JS (it's `HttpOnly`) |
| Clear the access token from memory on logout or when refresh fails | Keep a stale access token around after logout |

> The refresh cookie uses `SameSite=Strict`, `HttpOnly`, and `Secure` (in production). It is only sent to paths under `/api/v1/auth`, so it never leaks to other API endpoints.

### Access token JWT payload

The token payload is not encrypted (only signed). **Do not use it as a source of user information** — always fetch user data from `GET /auth/me` instead.

The only claim you should read client-side is `exp`, solely to schedule a proactive refresh:

```json
{
  "sub": "john.doe",
  "role": "user",
  "groups": ["Staff", "Finance"],
  "type": "access",
  "iat": 1712678400,
  "exp": 1712679300
}
```

| Claim | Client-side use |
|---|---|
| `exp` | Decode to schedule proactive refresh (see section 4A) |
| `sub`, `role`, `groups`, `type` | **Do not read from the token** — use `GET /auth/me` instead |

---

## Roles & authorization

The API enforces a **role hierarchy**:

```
guest < user < manager < admin
```

A higher role inherits all permissions of lower roles. Some endpoints also check **group membership** (e.g. `HR`, `IT-Admins`, `Reports-Admin`).

| Area | View | Create / Update | Delete |
|---|---|---|---|
| **Reports** | `user` and above | `user` and above (owner or `manager`+) | `admin` or `Reports-Admin` group |
| **Users** | `manager`+ or `HR` / `IT-Admins` groups | `admin` or `IT-Admins` group | `admin` or `IT-Admins` group |

Always use `GET /auth/me` to get `role`, `groups`, and other user info for driving your UI — e.g. hide the "Delete" button if the user isn't an admin. Do not decode these values from the token.

---

## Auth endpoints

All auth routes are under `/api/v1/auth`.

### 1. Login

```http
POST /auth/login
Content-Type: application/json

{
  "username": "john.doe",
  "password": "secret"
}
```

```js
const res = await fetch(`${BASE_URL}/auth/login`, {
  method: "POST",
  credentials: "include",  // required so the browser stores the Set-Cookie
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const data = await res.json();
// data = { accessToken, user: { username, role, groups } }
```

**Success `200`**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "username": "john.doe",
    "role": "user",
    "groups": ["Staff"]
  }
}
```

- Store `accessToken` **in memory**.
- The browser receives and stores the `HttpOnly` refresh cookie automatically — you never touch it.
- Schedule the first proactive refresh (see section 4).

**Errors**

| Status | Meaning |
|---|---|
| `400` | Missing or invalid `username` / `password` |
| `401` | Wrong credentials |
| `429` | Rate-limited — too many login attempts (per-IP or per-username). Retry after the window indicated in the `Retry-After` header. |

> **Rate limits on login:** The server enforces two separate limiters — one by **IP** and one by **username**. If either is tripped you'll receive `429`. Read the `Retry-After` or `RateLimit-Reset` response headers to know when to retry.

---

### 2. Refresh

```http
POST /auth/refresh
```

No body, no `Authorization` header needed. The browser sends the cookie.

```js
const res = await fetch(`${BASE_URL}/auth/refresh`, {
  method: "POST",
  credentials: "include",  // REQUIRED — attaches the httpOnly cookie
});
```

**Success `200`**

```json
{ "accessToken": "<new jwt>" }
```

Replace the old access token in memory and reschedule the next refresh.

**Errors** — all return `401`

| Message | Meaning | Action |
|---|---|---|
| `Refresh token cookie missing` | Cookie absent — user never logged in or cookie expired | Redirect to login |
| `Refresh token expired` | The refresh JWT itself has expired | Redirect to login |
| `Refresh token has been revoked` | Server-side denylist (user logged out elsewhere, or admin revoked) | Redirect to login |
| `User no longer exists` | The account was deleted while the session was active | Redirect to login |
| `429` | Too many refresh attempts (30 per 15 min window) | Back off and retry |

> **Important:** Any `401` from the refresh endpoint means the session is dead. Clear the access token from memory and redirect the user to the login page — do **not** retry.

---

### 3. Logout

Requires **both** the access token (to authenticate) and `credentials: "include"` (to send the cookie for server-side revocation).

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

```js
await fetch(`${BASE_URL}/auth/logout`, {
  method: "POST",
  credentials: "include",
  headers: { Authorization: `Bearer ${accessToken}` },
});

setAccessToken(null);     // discard from memory
clearRefreshTimer();      // cancel any scheduled refresh
```

**Success `200`**

```json
{ "message": "Logged out successfully" }
```

The server revokes the refresh token and clears the cookie. Any future refresh attempt returns `401`.

---

### 4. Get current user

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

**Success `200`**

```json
{
  "username": "john.doe",
  "role": "user",
  "groups": ["Staff"]
}
```

Returns the current user's profile from the server. **This is the only authoritative source of user info** — always call this endpoint to populate the user's identity in your app (role, groups, username). Never rely on data decoded from the token for this purpose.

---

## Protected endpoints (non-auth)

Every other API route requires a valid access token in the `Authorization` header:

```js
const res = await fetch(`${BASE_URL}/reports`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

> You do **not** need `credentials: "include"` for non-auth endpoints. The refresh cookie is scoped to `/api/v1/auth` and won't be sent anyway.

### All routes reference

| Method | Endpoint | Auth | Role / Group required |
|---|---|---|---|
| `POST` | `/auth/login` | No | — |
| `POST` | `/auth/refresh` | Cookie only | — |
| `POST` | `/auth/logout` | Bearer token | Any authenticated |
| `GET` | `/auth/me` | Bearer token | Any authenticated |
| `POST` | `/reports` | Bearer token | `user`+ |
| `GET` | `/reports` | Bearer token | `user`+ |
| `GET` | `/reports/stats` | Bearer token | `user`+ |
| `GET` | `/reports/:id` | Bearer token | `user`+ |
| `PATCH` | `/reports/:id` | Bearer token | Owner or `manager`+ |
| `DELETE` | `/reports/:id` | Bearer token | `admin` or `Reports-Admin` group |
| `GET` | `/users/stats` | Bearer token | `manager`+ or `HR` / `IT-Admins` group |
| `GET` | `/users` | Bearer token | `manager`+ or `HR` / `IT-Admins` group |
| `GET` | `/users/:id` | Bearer token | `manager`+ or `HR` / `IT-Admins` group |
| `PATCH` | `/users/:id` | Bearer token | `admin` or `IT-Admins` group |
| `DELETE` | `/users/:id` | Bearer token | `admin` or `IT-Admins` group |

All `/reports` and `/users` paths are prefixed with `/api/v1`.

---

## Refresh strategy — recommended implementation

Use all three approaches together for a seamless experience.

### A. Proactive refresh (timer)

Decode the `exp` claim and schedule a refresh ~30 seconds before the token expires:

```js
let refreshTimer;

function scheduleRefresh(accessToken) {
  clearTimeout(refreshTimer);
  const { exp } = JSON.parse(atob(accessToken.split(".")[1]));
  const msUntilExpiry = exp * 1000 - Date.now();
  const refreshIn = msUntilExpiry - 30_000; // 30s before expiry

  if (refreshIn <= 0) return doRefresh(); // already expired — refresh now

  refreshTimer = setTimeout(doRefresh, refreshIn);
}
```

Call `scheduleRefresh(accessToken)` after login and after every successful refresh.

### B. Reactive refresh (on 401)

If any API call returns `401`, attempt a silent refresh and retry once:

```js
async function apiFetch(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getAccessToken()}` },
  });

  if (res.status === 401) {
    try {
      const { accessToken } = await doRefresh();
      setAccessToken(accessToken);
      scheduleRefresh(accessToken);
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

> **Tip:** Guard against concurrent refresh calls. If multiple 401s arrive at the same time, only fire one refresh and let the others wait for the result.

### C. Silent refresh on page load

The access token lives in memory, so it's lost on page reload. On app init, attempt a refresh to restore the session:

```js
async function init() {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("refresh failed");
    const { accessToken } = await res.json();
    setAccessToken(accessToken);
    scheduleRefresh(accessToken);
    // Always call GET /auth/me to hydrate user profile — do not decode user info from the token
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await meRes.json();
    setUser(user);
  } catch {
    setAccessToken(null); // no valid session — show login page
  }
}
```

---

## Error response format

All error responses follow the same shape:

```json
{
  "status": 401,
  "message": "Authentication required."
}
```

Validation errors (`400`) include an `errors` array:

```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "username", "message": "Username is required" }
  ]
}
```

---

## CORS

The API allows requests from **any origin** (`origin: true`).

- Credentials (`cookies`) are allowed — hence `credentials: "include"` works.
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Allowed headers: `Content-Type`, `Authorization`.

---

## Quick checklist

- [ ] `credentials: "include"` on **login**, **refresh**, and **logout** calls
- [ ] Access token stored **only** in memory — never `localStorage`
- [ ] Proactive refresh timer scheduled after login and on every successful refresh
- [ ] Silent refresh attempted on app startup / page reload
- [ ] Any `401` from `/auth/refresh` → clear state and redirect to login
- [ ] `GET /auth/me` called after login and after every silent refresh to hydrate user info — **never decode user data from the token**
- [ ] UI elements hidden/shown based on `role` and `groups` from `GET /auth/me`
- [ ] `Retry-After` header respected when receiving `429`
