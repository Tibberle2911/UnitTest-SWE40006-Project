/**
 * Task Tracker - Version 1.0 (Base App)
 * -------------------------------------
 * Requirements implemented:
 *  - Users can add a task (name, date, time, description).
 *  - Each task gets an automatic ID (server-generated).
 *  - Scheduled tasks trigger a small notification in the browser when due.
 *  - After the due time, tasks appear in the user's "Dashboard" list.
 *  - Task data is stored in an `eventlist.txt` file (append-only event log).
 *  - Updates do NOT replace the file; adds/deletes are appended as events.
 *  - Deleting a task appends a "delete" event; the task is removed logically.
 *
 * Notes on design decisions (to support future versions 1.1 / 1.2 / 2.0):
 *  - We use an append-only event log stored in ./eventlist.txt. Each line is a JSON object.
 *    Event types supported in v1.0: "create", "delete".
 *    This satisfies "append or modified in-place" without replacing the file.
 *  - The in-memory projection is reconstructed on each GET /api/tasks.
 *  - We purposely keep the code small, single-file server and static frontend for pipeline demos.
 *  - For v1.1 (Themes): hooks exist in the frontend to swap a CSS data-theme attribute.
 *  - For v1.2 (Priority): the schema already allows "priority" later without breaking storage.
 *  - For v2.0 (Failing Update): remove the file and write code branches that do NOT touch it.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- File where events are stored (append-only) ---
const EVENT_FILE = path.join(__dirname, process.env.EVENT_FILE || 'eventlist.txt');

// --- Middleware to parse JSON bodies ---
app.use(express.json());

// --- Serve the frontend from /public ---
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Utility: simple unique ID generator (no external libs).
 * Combines current time and a random number for low collision risk.
 */
function makeId() {
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `t_${Date.now().toString(36)}_${rand}`;
}

/**
 * Utility: append a single event line to eventlist.txt.
 * Creates the file if it does not exist (v1.0 requires the file to exist).
 */
function appendEvent(evtObj) {
  const line = JSON.stringify(evtObj) + '\n';
  fs.appendFileSync(EVENT_FILE, line, { encoding: 'utf-8' });
}

/**
 * Utility: read all events from eventlist.txt and build the current state (projection).
 * This function **does not** replace the file; it only reads and interprets the event log.
 * A "delete" event marks a task as removed.
 */
function readProjection() {
  let tasks = new Map();  // id -> task object
  let deleted = new Set();

  if (!fs.existsSync(EVENT_FILE)) {
    // If the file is missing, in v1.0 we create it (this is the "working" version behavior).
    // NOTE: For v2.0 failing update, this creation would be removed.
    fs.writeFileSync(EVENT_FILE, '', { encoding: 'utf-8' });
  }

  const data = fs.readFileSync(EVENT_FILE, 'utf-8');
  const lines = data.split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'create') {
        tasks.set(evt.id, {
          id: evt.id,
          name: evt.name,
          date: evt.date,       // "YYYY-MM-DD" or empty string
          time: evt.time,       // "HH:MM" (24h) or empty string
          description: evt.description || '',
          createdAt: evt.createdAt || new Date().toISOString()
          // priority: (future v1.2) can be added later without breaking
        });
      } else if (evt.type === 'delete') {
        deleted.add(evt.id);
        tasks.delete(evt.id);
      }
    } catch (e) {
      console.error('Skipping bad event line:', line, e.message);
    }
  }
  return Array.from(tasks.values());
}

/**
 * GET /api/tasks
 * Returns the projection of current tasks (scheduled + active). The frontend decides
 * where to render (scheduled vs dashboard) based on due times.
 */
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = readProjection();
    res.json({ ok: true, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to read tasks.' });
  }
});

/**
 * POST /api/tasks
 * Body: { name, date, time, description }
 * Creates a new task with a server-generated ID, appends a "create" event to file.
 */
app.post('/api/tasks', (req, res) => {
  try {
    const { name, date, time, description } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Name is required.' });
    }

    // Validate date/time lightly; allow empty for future versions (priority-only tasks).
    const id = makeId();
    const evt = {
      type: 'create',
      id,
      name: String(name).trim(),
      date: date ? String(date) : '',
      time: time ? String(time) : '',
      description: description ? String(description) : '',
      createdAt: new Date().toISOString()
    };
    appendEvent(evt);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to create task.' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Appends a "delete" event so the task is considered removed in the projection.
 */
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Task ID required.' });
    }
    const evt = { type: 'delete', id, deletedAt: new Date().toISOString() };
    appendEvent(evt);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to delete task.' });
  }
});

app.listen(PORT, () => {
  console.log(`Task Tracker v1.0 listening on http://localhost:${PORT}`);
});
