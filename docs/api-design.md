# QuickNotes API — Design

Base URL: `https://api.quicknotes.com`

All requests use HTTPS. All request and response bodies are JSON.

---

## Endpoints

| # | Method | Path | Description | Success status |
|---|---|---|---|---|
| 1 | GET | `/notes` | List all notes belonging to the logged-in user. Supports `?category=` and `?search=` query parameters. | 200 OK |
| 2 | GET | `/notes/:id` | Get one note by its id. | 200 OK |
| 3 | POST | `/notes` | Create a new note. The note's data goes in the request body. | 201 Created |
| 4 | PATCH | `/notes/:id` | Update some fields of an existing note (for example, just the text). | 200 OK |
| 5 | DELETE | `/notes/:id` | Delete a note by its id. | 204 No Content |
| 6 | GET | `/notes?category=work` | List notes filtered by category. Query parameters are joined with `&`, e.g. `/notes?category=work&search=report`. | 200 OK |
| 7 | POST | `/auth/login` | Log in with email and password, receive a token. | 200 OK |
| 8 | GET | `/users/me` | Get the profile of the currently logged-in user. | 200 OK |

---

## Example: creating a note

**Request**

```
POST /notes HTTP/1.1
Host: api.quicknotes.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```json
{
  "text": "Finish the Day 8 presentation",
  "category": "study"
}
```

**Response — 201 Created**

```json
{
  "id": 42,
  "text": "Finish the Day 8 presentation",
  "category": "study",
  "createdAt": "2026-10-10T14:32:00Z"
}
```

---

## Example: listing notes

**Request**

```
GET /notes?category=study HTTP/1.1
Host: api.quicknotes.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response — 200 OK**

```json
[
  {
    "id": 1,
    "text": "Revise HTTP methods",
    "category": "study",
    "createdAt": "2026-09-21T09:15:00Z"
  },
  {
    "id": 4,
    "text": "Revise JavaScript arrays",
    "category": "study",
    "createdAt": "2026-09-22T11:00:00Z"
  }
]
```

---

## Error responses

Every error response has the same shape:

```json
{ "error": "Human-readable message." }
```

| Status | When it happens | Example body |
|---|---|---|
| **400 Bad Request** | The request body is invalid — for example, an empty or over-200-character note. | `{ "error": "Note text must be 1-200 characters." }` |
| **401 Unauthorized** | No `Authorization` header, or the token is missing/expired/invalid. | `{ "error": "Authentication required." }` |
| **403 Forbidden** | The user is logged in but is not allowed to touch this resource (e.g. deleting another user's note). | `{ "error": "You do not have permission to delete this note." }` |
| **404 Not Found** | The requested note or path does not exist. | `{ "error": "Note 42 not found." }` |
| **500 Internal Server Error** | Something broke on the server — an unhandled exception or database failure. | `{ "error": "Something went wrong on our side. Please try again." }` |

---

## Notes on conventions

- **Resources are plural nouns.** `/notes`, not `/getNotes`.
- **The HTTP method says what to do.** `POST /notes` creates; `DELETE /notes/42` removes.
- **The URL says what to do it to.** `/notes/42` is one specific note.
- **Stateless.** Every request carries the auth token — the server remembers nothing between requests.
- **User scoping.** Every `/notes` endpoint only returns or modifies the logged-in user's own notes. The server adds `AND user_id = ?` to every query.
