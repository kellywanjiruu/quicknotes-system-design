# QuickNotes — Data Model

The relational schema for QuickNotes, using PostgreSQL-style SQL.

---

## Entities

### `users`

| Column | Type | Key / rule |
|---|---|---|
| `id` | `INTEGER` | **Primary key** |
| `email` | `TEXT` | `NOT NULL`, `UNIQUE` |
| `name` | `TEXT` | `NOT NULL` |
| `password_hash` | `TEXT` | `NOT NULL` (never store plain passwords) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

### `notes`

| Column | Type | Key / rule |
|---|---|---|
| `id` | `INTEGER` | **Primary key** |
| `user_id` | `INTEGER` | **Foreign key** → `users.id`, `NOT NULL` |
| `text` | `TEXT` | `NOT NULL`, `CHECK (length(text) <= 200)` |
| `category` | `TEXT` | `NOT NULL`, `DEFAULT 'personal'` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` |

### `tags`

| Column | Type | Key / rule |
|---|---|---|
| `id` | `INTEGER` | **Primary key** |
| `name` | `TEXT` | `NOT NULL`, `UNIQUE` |

### `note_tags` (join table)

| Column | Type | Key / rule |
|---|---|---|
| `note_id` | `INTEGER` | **Foreign key** → `notes.id`, part of composite PK |
| `tag_id` | `INTEGER` | **Foreign key** → `tags.id`, part of composite PK |

Primary key: **`(note_id, tag_id)`** — a composite key, which stops the same tag being attached to the same note twice.

---

## Relationships

- **users → notes** is **one-to-many**. One user can have many notes; each note belongs to exactly one user. The relationship is stored as a foreign key `notes.user_id` pointing to `users.id`.
- **notes ↔ tags** is **many-to-many**. One note can have many tags, and one tag can appear on many notes. This cannot be stored in either table on its own — a column holds one value. So we introduce a **join table** (`note_tags`) that stores one row per pairing.

---

## CREATE TABLE statements

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  text       TEXT NOT NULL CHECK (length(text) <= 200),
  category   TEXT NOT NULL DEFAULT 'personal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

---

## Example queries

**1. All of a user's notes, newest first**

```sql
SELECT id, text, category, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC;
```

**2. All notes tagged "urgent" (uses two JOINs across the join table)**

```sql
SELECT notes.text, notes.category
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags      ON tags.id = note_tags.tag_id
WHERE tags.name = 'urgent';
```

**3. Count of notes per user (uses LEFT JOIN so users with no notes still show)**

```sql
SELECT users.name, COUNT(notes.id) AS note_count
FROM users
LEFT JOIN notes ON notes.user_id = users.id
GROUP BY users.id
ORDER BY note_count DESC;
```

---

## Index

```sql
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

**Reason:** The most common query against `notes` is "fetch this user's notes" (`WHERE user_id = ?`). Without an index, the database scans every row in the table. With an index on `user_id`, it jumps straight to that user's rows — a huge speedup once the table has millions of rows. A second useful index would be `CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);` for the reverse query ("who has this tag?"). We do **not** index `category`, because it is low-cardinality (only a few distinct values), so the index would rarely help.

---

## SQL or NoSQL?

**SQL is the right choice for QuickNotes.** The data is highly structured — users, notes and tags each have a fixed, well-known shape — and the relationships between them are central to how the app works. Foreign keys and `CHECK` constraints let the database itself guarantee correctness (no orphan notes, notes ≤ 200 characters, unique emails). JOINs are the natural way to answer questions like "all notes tagged urgent" or "how many notes per user". SQL also gives us transactions, so a multi-step change can be made all-or-nothing. A document (NoSQL) database would push all these rules into application code, and the many-to-many relationship between notes and tags would have to be duplicated across documents. For a structured, relationship-heavy app, SQL is the right tool.
