# User Route Guide

> Last updated: April 2026

Base URL: `http://localhost:5000/api/v1`

---

## Authorization

All user endpoints require authentication. Access is split into two tiers:

| Action | Allowed roles / groups |
|--------|------------------------|
| **View** (list, get, stats) | `manager`, `admin`, or members of `HR` / `IT-Admins` groups |
| **Manage** (update, delete) | `admin` only, or members of `IT-Admins` group |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List users with filtering & pagination |
| `GET` | `/users/stats` | Aggregate user statistics |
| `GET` | `/users/:id` | Get a single user |
| `PATCH` | `/users/:id` | Update a user's role or groups |
| `DELETE` | `/users/:id` | Delete a user |

---

## GET /users — List Users

Returns a paginated list of users, sorted alphabetically by username. Groups are populated with their name.

### Query Parameters

| Param    | Type   | Default | Constraints          | Description                              |
|----------|--------|---------|----------------------|------------------------------------------|
| `role`   | string | —       | `guest`, `user`, `manager`, `admin` | Filter by exact role        |
| `group`  | string | —       | 24-char ObjectId     | Filter by group membership               |
| `search` | string | —       | max 100 chars        | Partial username match (case-insensitive) |
| `page`   | number | `1`     | min 1                | Page number                              |
| `limit`  | number | `20`    | 1–100                | Results per page                         |

### Example Requests

**All managers:**
```bash
curl "http://localhost:5000/api/v1/users?role=manager" \
  -H "Authorization: Bearer <access_token>"
```

**Search by username:**
```bash
curl "http://localhost:5000/api/v1/users?search=dev&limit=10" \
  -H "Authorization: Bearer <access_token>"
```

**Filter by group ID:**
```bash
curl "http://localhost:5000/api/v1/users?group=6643a1f200000000000000aa" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "data": [
    {
      "_id": "6643a1f2e4b0c1a2d3e4f567",
      "username": "alex.dev",
      "role": "user",
      "groups": [
        { "_id": "6643a1f200000000000000aa", "name": "Staff" }
      ],
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "total": 11,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false
}
```

---

## GET /users/stats — User Statistics

Returns aggregate statistics. No query parameters.

### Example Request

```bash
curl "http://localhost:5000/api/v1/users/stats" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "total": 11,
  "byRole": {
    "guest": 2,
    "user": 5,
    "manager": 3,
    "admin": 2
  },
  "byGroup": [
    { "group": "Staff", "groupId": "...", "count": 5 },
    { "group": "IT-Admins", "groupId": "...", "count": 3 },
    { "group": "Managers", "groupId": "...", "count": 4 },
    { "group": "Finance", "groupId": "...", "count": 2 }
  ],
  "recent": {
    "last7Days": 0,
    "last30Days": 3
  }
}
```

---

## GET /users/:id — Single User

### URL Parameter

| Param | Type   | Description              |
|-------|--------|--------------------------|
| `id`  | string | MongoDB ObjectId of the user |

### Example Request

```bash
curl "http://localhost:5000/api/v1/users/6643a1f2e4b0c1a2d3e4f567" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "_id": "6643a1f2e4b0c1a2d3e4f567",
  "username": "alex.dev",
  "role": "user",
  "groups": [
    { "_id": "6643a1f200000000000000aa", "name": "Staff" }
  ],
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-01T10:00:00.000Z"
}
```

### Response 404

```json
{ "message": "User 6643a1f2e4b0c1a2d3e4f567 not found" }
```

---

## PATCH /users/:id — Update User

Update a user's role and/or group assignments. Requires `admin` role or `IT-Admins` group membership.

### Guards

- You **cannot** update your own account through this endpoint (returns `403`).
- All supplied group IDs must exist in the database (returns `400` otherwise).

### Body (JSON) — all fields optional

| Field    | Type     | Constraints                          | Description                        |
|----------|----------|--------------------------------------|------------------------------------|
| `role`   | string   | `guest`, `user`, `manager`, `admin`  | New role for the user              |
| `groups` | string[] | Array of 24-char ObjectIds           | Replace the user's group list      |

At least **one field** must be provided.

### Example Requests

**Change role:**
```bash
curl -X PATCH "http://localhost:5000/api/v1/users/6643a1f2e4b0c1a2d3e4f567" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "role": "manager" }'
```

**Update groups:**
```bash
curl -X PATCH "http://localhost:5000/api/v1/users/6643a1f2e4b0c1a2d3e4f567" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "groups": ["6643a1f200000000000000aa", "6643a1f200000000000000bb"] }'
```

### Response 200

Returns the updated user document with groups populated.

### Response 400

Returned when one or more group IDs don't exist.

### Response 403

Returned when trying to modify your own account.

### Response 404

Returned when the target user doesn't exist.

---

## DELETE /users/:id — Delete User

Permanently removes a user. Requires `admin` role or `IT-Admins` group membership.

### Guards

- You **cannot** delete your own account (returns `403`).

### Example Request

```bash
curl -X DELETE "http://localhost:5000/api/v1/users/6643a1f2e4b0c1a2d3e4f567" \
  -H "Authorization: Bearer <access_token>"
```

### Response 204

User was successfully deleted. No response body.

### Response 403

Returned when trying to delete your own account.

### Response 404

Returned when no user exists with the given ID.

---

## Frontend Usage (React / Fetch)

```ts
interface UserEntry {
  _id: string;
  username: string;
  role: "guest" | "user" | "manager" | "admin";
  groups: { _id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

interface UserListResponse {
  data: UserEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

async function fetchUsers(
  accessToken: string,
  params?: { role?: string; group?: string; search?: string; page?: number; limit?: number }
): Promise<UserListResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) query.set(key, String(val));
    });
  }

  const res = await fetch(`http://localhost:5000/api/v1/users?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to fetch users");
  }

  return res.json();
}

async function updateUser(
  userId: string,
  updates: { role?: string; groups?: string[] },
  accessToken: string
): Promise<UserEntry> {
  const res = await fetch(`http://localhost:5000/api/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to update user");
  }

  return res.json();
}

async function deleteUser(userId: string, accessToken: string): Promise<void> {
  const res = await fetch(`http://localhost:5000/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to delete user");
  }
}
```

### Quick Examples

```ts
// List all admins
const admins = await fetchUsers(token, { role: "admin" });

// Search for users with "dev" in their username
const devs = await fetchUsers(token, { search: "dev" });

// Promote a user to manager
await updateUser("6643a1f2e4b0c1a2d3e4f567", { role: "manager" }, token);

// Remove a user
await deleteUser("6643a1f2e4b0c1a2d3e4f567", token);
```
