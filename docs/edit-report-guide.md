# Edit Report Guide

> Last updated: April 2026

Base URL: `http://localhost:5000/api/v1`

---

## Endpoint

```
PATCH /reports/:id
```

**Authentication:** Required (Bearer token in `Authorization` header).

**Authorization:**
- The **report owner** (the user in `createdBy`) can edit their own reports.
- **Managers** and **admins** can edit any report.
- All other users receive `403 Forbidden`.

Minimum role to access this endpoint: `user`.

---

## Request

### URL Parameter

| Param | Type   | Description              |
|-------|--------|--------------------------|
| `id`  | string | MongoDB ObjectId of the report to update |

### Body (JSON) — all fields optional

| Field         | Type     | Constraints              | Notes                          |
|---------------|----------|--------------------------|--------------------------------|
| `title`       | string   | 1–200 characters         | Short display name             |
| `description` | string   | 1–500 characters         | One-paragraph summary          |
| `content`     | object   | `Record<string, unknown>`| Full report payload            |
| `status`      | string   | `"draft"` or `"published"` | Defaults to `"published"` if provided |

At least **one field** must be included in the request body.

### Example Request

```bash
curl -X PATCH http://localhost:5000/api/v1/reports/6643a1f2e4b0c1a2d3e4f567 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Report Title",
    "status": "published"
  }'
```

---

## Responses

### 200 — Success

Returns the full updated report document:

```json
{
  "_id": "6643a1f2e4b0c1a2d3e4f567",
  "title": "Updated Report Title",
  "description": "Original description",
  "content": { "key": "value" },
  "status": "published",
  "version": 2,
  "createdBy": { "username": "user.dev", "userId": "..." },
  "updatedBy": { "username": "user.dev", "userId": "..." },
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-04-15T14:30:00.000Z"
}
```

### 400 — Validation Error

Returned when the body is empty or field constraints are violated.

### 403 — Forbidden

Returned when the authenticated user is not the report owner and is not a manager/admin.

### 404 — Not Found

Returned when no report exists with the given `id`.

---

## Frontend Usage (React / Fetch)

```ts
async function editReport(
  reportId: string,
  updates: { title?: string; description?: string; content?: object; status?: "draft" | "published" },
  accessToken: string
): Promise<Report> {
  const res = await fetch(`http://localhost:5000/api/v1/reports/${reportId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to update report");
  }

  return res.json();
}
```

### Quick Examples

**Change title only:**
```ts
await editReport("6643a1f2e4b0c1a2d3e4f567", { title: "New Title" }, token);
```

**Publish a draft:**
```ts
await editReport("6643a1f2e4b0c1a2d3e4f567", { status: "published" }, token);
```

**Update multiple fields:**
```ts
await editReport("6643a1f2e4b0c1a2d3e4f567", {
  title: "Q1 Summary — Final",
  description: "Revised quarterly summary with updated figures.",
  status: "published",
}, token);
```
