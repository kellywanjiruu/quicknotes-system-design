# QuickNotes — System Design

A full system design for **QuickNotes**, a note-taking web app used by 1 million people. This repository contains both a working API client (proving the front end can talk to a REST API) and the design documents a backend team would build from.

---

## Description

QuickNotes started as a browser-only app that kept its data in `localStorage`. This project takes it online: a JSON-based REST API in front of a relational database, served through a load balancer and a CDN, with caching, read replicas and a background worker for slow jobs.

The repository has two halves:

- **An API client** (`index.html`, `api.js`, `style.css`) that talks to the JSONPlaceholder practice API to load, create and delete notes. It demonstrates `fetch`, `async / await`, error handling and all four UI states (loading, success, error, empty).
- **Three design documents** in `docs/` that describe the real system the backend team will build.

---

## How to run the API client

No build step, no dependencies.

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/quicknotes-system-design.git
   ```

2. Open `index.html` in your browser. That's it.

   **Recommended:** install the **Live Server** extension in VS Code, right-click `index.html` and choose **Open with Live Server**.

3. Try it:
   - Click **Load notes** — 10 notes come back from `https://jsonplaceholder.typicode.com/posts?_limit=10`.
   - Type a title (and optionally a body) and click **Create note** — a new note appears at the top of the list with a status message showing the new id and status code.
   - Click **Delete** on any note — it disappears from the list.

> **Note:** JSONPlaceholder is a fake API. It replies realistically to `POST` and `DELETE` (with `201` and `204`), but it does **not** actually save changes. A created note always comes back with `id: 101`, and a deleted note reappears if you reload the list. This is expected — a real API would persist every change.

---

## Design documents

- **[API design](docs/api-design.md)** — the REST endpoints, request/response examples and error codes for the real QuickNotes API.
- **[Data model](docs/data-model.md)** — the SQL schema: `users`, `notes`, `tags` and the `note_tags` join table, plus relationships, indexes and example queries.
- **[Architecture](docs/architecture.md)** — the system design at 1 million users: requirements, load estimates, the full architecture diagram, request flows and trade-offs.

---

## What I learned

- **REST is method + path, not verbs.** Using `GET /notes` and `DELETE /notes/42` is clearer than `/getNotes` or `/deleteNote/42`, and the method already says what you mean.
- **`fetch` does not throw on HTTP errors.** A `404` or `500` returns a normal response with `response.ok === false`, so I have to check `ok` and throw my own error — otherwise the app silently shows wrong data.
- **The render pattern keeps the UI in sync with the data.** Instead of editing the DOM in several places, I keep one `notes` array and one `render()` function; every action updates the data and re-renders.
- **Errors belong on the page, not just in the Console.** Showing loading, success, error and empty states turns a demo into an app a real user can trust.
- **Good design documents are as important as good code.** Writing the API design, data model and architecture forced me to think about status codes, foreign keys and trade-offs that I would otherwise have glossed over.

---

## Repository structure

```
quicknotes-system-design/
├── index.html
├── style.css
├── api.js
├── README.md
└── docs/
    ├── api-design.md
    ├── data-model.md
    └── architecture.md
```
