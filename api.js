// ============================================
// QuickNotes — API client
// ============================================

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

// ---------- Select elements ----------
const loadBtn = document.querySelector("#load-btn");
const statusText = document.querySelector("#status");
const list = document.querySelector("#notes-list");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

// ---------- Reusable request helper ----------
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Server responded with status ${response.status}`);
  }
  if (response.status === 204) return { data: null, status: response.status };
  const data = await response.json();
  return { data, status: response.status };
}

// ---------- Helpers ----------
function setStatus(message, type) {
  statusText.textContent = message;
  statusText.classList.remove("status-success", "status-error");
  if (type) statusText.classList.add(`status-${type}`);
}

function showEmpty(message) {
  const li = document.createElement("li");
  li.classList.add("empty-message");
  li.textContent = message;
  list.appendChild(li);
}

function buildNoteElement(note) {
  const li = document.createElement("li");
  li.classList.add("note");

  const title = document.createElement("h3");
  title.classList.add("note-title");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.classList.add("note-body");
  body.textContent = note.body || "";

  li.appendChild(title);
  li.appendChild(body);
  return li;
}

function renderNotes(notes) {
  list.innerHTML = "";
  if (notes.length === 0) {
    showEmpty("No notes yet. Create one above!");
    return;
  }
  notes.forEach((note) => list.appendChild(buildNoteElement(note)));
}

// ---------- GET: load notes ----------
async function loadNotes() {
  setStatus("Loading notes...", null);
  loadBtn.disabled = true;
  list.innerHTML = "";

  try {
    const { data: notes } = await request(`${API_URL}?_limit=10`);
    renderNotes(notes);
    setStatus(`Loaded ${notes.length} notes from the server.`, "success");
  } catch (error) {
    setStatus("Could not load notes. Please try again.", "error");
    console.error("Load failed:", error.message);
  } finally {
    loadBtn.disabled = false;
  }
}

// ---------- POST: create note ----------
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please type a title first.", "error");
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    setStatus(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`, "error");
    return;
  }

  setStatus("Creating note...", null);
  submitBtn.disabled = true;

  try {
    const { data: created, status } = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, userId: 1 }),
    });

    list.insertBefore(buildNoteElement(created), list.firstChild);
    setStatus(
      `Note created (status ${status}, id ${created.id}).`,
      "success"
    );
    form.reset();
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error("Create failed:", error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Wire the load button ----------
loadBtn.addEventListener("click", loadNotes);
