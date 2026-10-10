# QuickNotes — Architecture

The system design for QuickNotes at 1 million registered users.

---

## 1. Requirements

### Functional requirements

- Users can register, log in and receive an auth token.
- Users can create, read, update and delete their own notes.
- Users can tag notes and filter by tag or category.
- Users can search their own notes.
- Only the note's owner can modify or delete it.

### Non-functional requirements

- **Availability:** 99.9% ("three nines") — about 8.8 hours of downtime per year is acceptable.
- **Latency:** p95 of `GET /notes` under 200 ms.
- **Scalability:** handle 1 million registered users without redesigning the system.
- **Consistency:** eventual consistency is acceptable for note lists (a note appearing a second late is fine).
- **Security:** HTTPS only, hashed passwords, no plain-text secrets in the browser.
- **Durability:** nightly database backups, tested restores.

---

## 2. Load estimate (1 million users)

Assumptions:

- 1,000,000 registered users.
- 20% active per day → **200,000 DAU**.
- Each active user creates 5 notes per day.
- Each active user loads their notes 20 times per day.
- An average note row is ~500 bytes.
- 1 day ≈ 100,000 seconds (rounded).
- Peak traffic is 5× the average.

**Writes**

```
200,000 × 5 = 1,000,000 notes/day
1,000,000 ÷ 100,000 ≈ 10 writes/s (average)
10 × 5 = 50 writes/s (peak)
```

**Reads**

```
200,000 × 20 = 4,000,000 loads/day
4,000,000 ÷ 100,000 ≈ 40 reads/s (average)
40 × 5 = 200 reads/s (peak)
```

**Storage per year**

```
1,000,000 notes/day × 500 bytes = 500 MB/day
500 MB × 365 ≈ 180 GB per year
```

**Interpretation:** QuickNotes is **read-heavy** (4× more reads than writes), so caching and read replicas are the highest-impact additions. 200 requests/second at peak is manageable for a few ordinary app servers, and 180 GB/year fits in a single well-configured database. This design does not need to be enormous.

---

## 3. Architecture diagram

```
   ┌─────────────────┐
   │ Browser / mobile│
   └────────┬────────┘
            │
       ┌────┴────┐
       │   DNS   │  quicknotes.com → IP addresses
       └────┬────┘
            │
   ┌────────┴─────────┐         static files
   │  Static CDN edge │ <───────────────────────────┐
   └────────┬─────────┘                             │
            │  API calls (HTTPS + JSON)             │
            v                                       │
     ┌─────────────┐                                │
     │Load balancer│                                │
     └──────┬──────┘                                │
       ┌────┼─────┬──────┐                         │
       v    v     v      v                         │
   ┌──────┐┌──────┐┌──────┐                        │
   │ App1 ││ App2 ││ App3 │──────> ┌──────────┐    │
   └───┬──┘└───┬──┘└───┬──┘        │  Redis   │    │
       │       │       │           │  cache   │    │
       │ writes│ reads │ jobs      └──────────┘    │
       v       v       v                            │
  ┌─────────┐ ┌────────────┐ ┌──────────┐  ┌──────────────┐
  │ Primary │>│ Read       │ │ Queue +  │  │ Object store │
  │   DB    │ │ replicas   │ │ worker   │  │ (images /    │
  └─────────┘ └────────────┘ └──────────┘  │  exports)    │
                                            └──────┬───────┘
                                                   │
                                          served by CDN on cache miss
```

---

## 4. Components — one sentence each

- **Client (browser/mobile)** — displays the UI and sends API requests; holds no authoritative data.
- **DNS** — resolves `quicknotes.com` to the system's IP addresses.
- **CDN** — serves static files (HTML, CSS, JS, images) from edge servers close to the user, cutting latency and keeping the app servers free.
- **Load balancer** — spreads incoming API requests across app servers and stops sending traffic to unhealthy ones.
- **App servers** — run the API code, and because they are stateless, any server can handle any request.
- **Cache (Redis)** — holds frequently requested data (like a user's note list) in memory, so most reads never touch the database.
- **Primary database** — holds the one true copy of the data and accepts all writes.
- **Read replicas** — copies of the primary that serve reads, taking load off the primary and providing failover.
- **Queue + worker** — handles slow jobs in the background (sending emails, generating exports) so the user is not kept waiting.
- **Object storage** — stores large files (exports, images) durably and cheaply; the database stores only the URL.

---

## 5. Request flows

### Flow of `GET /notes`

1. Browser resolves `api.quicknotes.com` via DNS (usually cached, ~0–20 ms).
2. Request goes to the **load balancer**, which picks the least busy healthy app server (~1 ms).
3. The app server reads the `Authorization` header, verifies the token, and identifies the user (~1–2 ms).
4. The app server asks Redis for `notes:user:1`.
   - **Cache hit** (~1 ms): return the cached list immediately.
   - **Cache miss** (~5–20 ms): query a **read replica** with `SELECT * FROM notes WHERE user_id = 1 ORDER BY created_at DESC`, store the result in Redis with a 5-minute TTL, then respond.
5. Response is sent back as JSON with status `200 OK`.
6. With 80–90% cache hits, the database only sees a small fraction of total traffic.

### Flow of `POST /notes`

1. Request goes to the load balancer, then to any healthy app server.
2. App server verifies the token, validates the note text (1–200 characters), and rejects invalid input with `400 Bad Request`.
3. App server writes the new note to the **primary database** (only the primary accepts writes), ~5–10 ms.
4. App server **deletes** `notes:user:1` from Redis, so the next read will fetch fresh data (invalidation).
5. App server returns `201 Created` with the new note's JSON.
6. Within a few milliseconds the primary replicates the new row to the read replicas.
7. If the note triggers a background job (e.g. sending a confirmation email), the app server adds a job to the queue and the worker processes it asynchronously.

---

## 6. Trade-offs

**1. Speed vs freshness.**
Caching note lists in Redis with a short TTL and serving reads from replicas makes the app fast, but a follower might see a note a second after it was created, or briefly see a stale cached version. This is completely acceptable for a note app — no one minds a one-second delay. A banking app would not accept this and would favour consistency over speed.

**2. Cost vs reliability.**
Adding read replicas, a second availability zone and backups costs real money. Keeping a single server in one region would be cheaper but would fail on any regional outage. We chose to spend on reliability because availability is a non-functional requirement ("three nines") and a note app that goes offline loses users permanently.

**3. Simplicity vs scalability.**
The plan above is a well-organised monolith: three app servers running the same code, all talking to the same cache and database. Splitting into microservices (a notes service, a search service, an auth service) would let teams deploy independently, but it would multiply the operational complexity. At 50 writes/s and 200 reads/s, a monolith scales comfortably — we should only split when a clear reason appears.

**4. Consistency vs availability (CAP theorem).**
When the primary database and the replicas cannot communicate (network partition), we must choose: refuse writes to stay correct, or accept writes and risk divergence. QuickNotes chooses availability for reads (serving from replicas) and consistency for writes (only the primary accepts them). This is the standard choice for a note app.

---

## 7. Avoiding single points of failure (SPOFs)

- **App servers:** no single server is required. The load balancer health-checks each one every few seconds and stops sending traffic to any that fail. Because the servers are stateless, requests can be retried on another server with no data loss.
- **Load balancer:** in a production deployment, the load balancer itself is a managed cloud service (e.g. AWS ELB) which is internally redundant.
- **Database:** the primary is a single point for writes, but if it fails, a read replica is promoted to become the new primary (failover). This limits downtime to seconds.
- **Cache:** if Redis is down, the app falls back to querying the database directly — slower, but the app still works.
- **Queue:** if the worker is down, jobs wait in the queue and are processed when it comes back. Users are not blocked.
- **CDN / DNS:** these are managed services with their own redundancy built in.
