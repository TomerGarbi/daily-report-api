# Log Route Guide

> Last updated: April 2026

Base URL: `http://localhost:5000/api/v1`

---

## Authorization

All log endpoints require authentication **and** one of the following:
- **Admin** role
- Membership in the **IT-Admins** AD group

All other users receive `403 Forbidden`.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/logs` | List logs with filtering & pagination |
| `GET` | `/logs/stats` | Aggregate log statistics |
| `GET` | `/logs/:id` | Get a single log entry |

---

## GET /logs — List Logs

Returns a paginated, filterable list of log entries sorted by most recent first.

### Query Parameters

| Param     | Type   | Default | Constraints              | Description                        |
|-----------|--------|---------|--------------------------|------------------------------------|
| `level`   | string | —       | `info`, `warn`, `error`, `debug` | Filter by log level        |
| `user`    | string | —       | max 100 chars            | Filter by username (case-insensitive substring) |
| `context` | string | —       | max 200 chars            | Filter by context/module (case-insensitive substring) |
| `search`  | string | —       | max 200 chars            | Search in log message (case-insensitive substring) |
| `from`    | string | —       | ISO 8601 date            | Logs on or after this timestamp    |
| `to`      | string | —       | ISO 8601 date            | Logs on or before this timestamp   |
| `page`    | number | `1`     | min 1                    | Page number                        |
| `limit`   | number | `50`    | 1–100                    | Results per page                   |

### Example Requests

**All error logs:**
```bash
curl "http://localhost:5000/api/v1/logs?level=error" \
  -H "Authorization: Bearer <access_token>"
```

**Search by message, last 7 days:**
```bash
curl "http://localhost:5000/api/v1/logs?search=failed&from=2026-04-08" \
  -H "Authorization: Bearer <access_token>"
```

**Logs from a specific user and context:**
```bash
curl "http://localhost:5000/api/v1/logs?user=admin.dev&context=AuthService&limit=20" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "data": [
    {
      "_id": "6643a1f2e4b0c1a2d3e4f567",
      "timestamp": "2026-04-15T10:23:45.000Z",
      "level": "error",
      "message": "Failed to authenticate user",
      "user": "system",
      "context": "AuthService",
      "meta": { "username": "john.doe", "reason": "invalid credentials" }
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 50,
  "totalPages": 3,
  "hasNextPage": true
}
```

---

## GET /logs/stats — Log Statistics

Returns aggregate statistics across all logs. No query parameters.

### Example Request

```bash
curl "http://localhost:5000/api/v1/logs/stats" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "total": 1284,
  "byLevel": {
    "info": 950,
    "warn": 180,
    "error": 42,
    "debug": 112
  },
  "recent": {
    "last24Hours": 87,
    "last7Days": 410
  },
  "topContexts": [
    { "context": "AuthService", "count": 320 },
    { "context": "ReportController", "count": 275 },
    { "context": "HealthCheck", "count": 190 }
  ]
}
```

| Field | Description |
|-------|-------------|
| `total` | Total log count across all time |
| `byLevel` | Breakdown by log level |
| `recent.last24Hours` | Logs created in the last 24 hours |
| `recent.last7Days` | Logs created in the last 7 days |
| `topContexts` | Top 10 most frequent context values |

---

## GET /logs/:id — Single Log Entry

### URL Parameter

| Param | Type   | Description              |
|-------|--------|--------------------------|
| `id`  | string | MongoDB ObjectId of the log entry |

### Example Request

```bash
curl "http://localhost:5000/api/v1/logs/6643a1f2e4b0c1a2d3e4f567" \
  -H "Authorization: Bearer <access_token>"
```

### Response 200

```json
{
  "_id": "6643a1f2e4b0c1a2d3e4f567",
  "timestamp": "2026-04-15T10:23:45.000Z",
  "level": "error",
  "message": "Failed to authenticate user",
  "user": "system",
  "context": "AuthService",
  "meta": { "username": "john.doe", "reason": "invalid credentials" }
}
```

### Response 404

```json
{ "message": "Log 6643a1f2e4b0c1a2d3e4f567 not found" }
```

---

## Frontend Usage (React / Fetch)

```ts
interface LogEntry {
  _id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  user: string;
  context?: string;
  meta?: Record<string, unknown>;
}

interface LogListResponse {
  data: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

async function fetchLogs(
  accessToken: string,
  params?: {
    level?: string;
    user?: string;
    context?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }
): Promise<LogListResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) query.set(key, String(val));
    });
  }

  const res = await fetch(`http://localhost:5000/api/v1/logs?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to fetch logs");
  }

  return res.json();
}
```

### Quick Examples

```ts
// All error logs
const errors = await fetchLogs(token, { level: "error" });

// Search for "timeout" in the last 24 hours
const recent = await fetchLogs(token, {
  search: "timeout",
  from: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
});

// Page 2 of auth-related logs
const authLogs = await fetchLogs(token, { context: "AuthService", page: 2, limit: 20 });
```
