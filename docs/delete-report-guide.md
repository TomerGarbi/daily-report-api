# Delete Report Guide

> Last updated: April 2026

Base URL: `http://localhost:5000/api/v1`

---

## Endpoint

```
DELETE /reports/:id
```

**Authentication:** Required (Bearer token in `Authorization` header).

**Authorization:**
- **Admins** can delete any report.
- Members of the **Reports-Admin** AD group can delete any report.
- All other users receive `403 Forbidden`.

> This is more restrictive than editing — regular users and managers **cannot** delete reports unless they belong to the `Reports-Admin` group.

---

## Request

### URL Parameter

| Param | Type   | Description              |
|-------|--------|--------------------------|
| `id`  | string | MongoDB ObjectId of the report to delete |

**No request body is required.**

### Example Request

```bash
curl -X DELETE http://localhost:5000/api/v1/reports/6643a1f2e4b0c1a2d3e4f567 \
  -H "Authorization: Bearer <access_token>"
```

---

## Responses

### 204 — No Content

The report was successfully deleted. No response body is returned.

### 403 — Forbidden

Returned when the authenticated user is not an admin and does not belong to the `Reports-Admin` group.

### 404 — Not Found

Returned when no report exists with the given `id`.

---

## Frontend Usage (React / Fetch)

```ts
async function deleteReport(reportId: string, accessToken: string): Promise<void> {
  const res = await fetch(`http://localhost:5000/api/v1/reports/${reportId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to delete report");
  }
}
```

### Quick Example

```ts
await deleteReport("6643a1f2e4b0c1a2d3e4f567", token);
```

---

## Notes

- Deletion is **permanent** — there is no soft-delete or trash/recycle bin.
- The operation is logged with the deleting user's username for audit purposes.
- If you need to hide a report without deleting it, consider updating its status to `"draft"` using the [edit endpoint](edit-report-guide.md) instead.
