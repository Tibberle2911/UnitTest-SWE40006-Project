/* 
  Frontend logic (no frameworks) for Version 1.0
  ------------------------------------------------
  - Fetch tasks from the server and render into two buckets:
      * Scheduled: not yet due (date+time in the future)
      * Dashboard (Active): due time has arrived/passed
  - Poll every 20 seconds to refresh and trigger due-notifications.
  - Notifications use the Web Notifications API (with alert fallback).
  - Delete calls DELETE /api/tasks/:id and re-renders.
*/

const scheduledList = document.getElementById('scheduledList');
const dashboardList = document.getElementById('dashboardList');
const form = document.getElementById('taskForm');

// Keep track of which tasks we already notified about during this session.
const notified = new Set();

/** Request permission for notifications on load (best-effort). */
if ('Notification' in window) {
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/** Convert task date/time into a local timestamp (ms since epoch). */
function taskDueTs(task) {
  // If date/time are empty or invalid, return NaN. (For v1.2 priority, tasks may not have date/time.)
  if (!task.date || !task.time) return NaN;
  const [y, m, d] = task.date.split('-').map(Number);
  const [hh, mm] = task.time.split(':').map(Number);
  const dt = new Date(y, (m - 1), d, hh || 0, mm || 0, 0, 0);
  return dt.getTime();
}
function taskDueTs(task) {
  // If date/time are empty or invalid, return NaN. (For v1.2 priority, tasks may not have date/time.)
  if (!task.date || !task.time) return NaN;
  const [y, m, d] = task.date.split('-').map(Number);
  const [hh, mm] = task.time.split(':').map(Number);
  const dt = new Date(y, (m - 1), d, hh || 0, mm || 0, 0, 0);
  return dt.getTime();
}

/** Render tasks into Scheduled and Dashboard buckets. */
function render(tasks) {
  scheduledList.innerHTML = '';
  dashboardList.innerHTML = '';

  const now = Date.now();

  const scheduled = [];
  const active = [];

  for (const t of tasks) {
    const due = taskDueTs(t);
    if (Number.isNaN(due)) {
      // No date/time => treat as "active" immediately for v1.0.
      active.push(t);
      continue;
    }
    if (due > now) scheduled.push(t);
    else active.push(t);
  }

  // Sort scheduled by ascending due date/time; active by most recent due first
  scheduled.sort((a, b) => (taskDueTs(a) || Infinity) - (taskDueTs(b) || Infinity));
  active.sort((a, b) => (taskDueTs(b) || 0) - (taskDueTs(a) || 0));

  for (const t of scheduled) scheduledList.appendChild(taskItem(t, false));
  for (const t of active) dashboardList.appendChild(taskItem(t, true));
}

/** Create a list item element for a task. */
function taskItem(task, isActive) {
  const li = document.createElement('li');
  li.className = 'task';

  const left = document.createElement('div');
  const right = document.createElement('div');
  right.className = 'controls';

  // Title + meta
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = task.name;

  const meta = document.createElement('div');
  meta.className = 'meta';
  const dateStr = task.date ? `Date: ${task.date}` : 'No date';
  const timeStr = task.time ? `Time: ${task.time}` : 'No time';
  meta.textContent = `${dateStr} • ${timeStr} • ID: ${task.id}`;

  // const desc = document.createElement('div');
  // desc.className = 'desc';
  // desc.textContent = task.description || '';

    const desc = document.createElement('div');
  desc.className = 'desc';
  desc.textContent = '';

  // left.appendChild(title);
  // left.appendChild(meta);

  left.appendChild(meta);
  left.appendChild(title);

  if (task.description) left.appendChild(desc);

  // Delete button only shown on active tasks (per "after due it appears in dashboard")
  if (isActive) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm('Delete this task?')) return;
      await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      await loadAndRender();
    };
    right.appendChild(delBtn);
  }

  li.appendChild(left);
  li.appendChild(right);
  return li;
}

/** Load tasks from the server and render them. Also trigger notifications for newly due tasks. */
async function loadAndRender() {
  const res = await fetch('/api/tasks');
  const data = await res.json();
  if (!data.ok) {
    alert('Failed to load tasks.');
    return;
  }

  const tasks = data.tasks || [];
  render(tasks);

  // Notify on tasks that just became due
  const now = Date.now();
  for (const t of tasks) {
    const due = taskDueTs(t);
    if (Number.isNaN(due)) continue;
    if (due <= now && !notified.has(t.id)) {
      notified.add(t.id);
      notify(`Task due: ${t.name}`, t.description || '');
    }
  }
}

/** Basic user notification helper with fallback. */
function notify(title, body = '') {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  } else {
    alert(`${title}\n${body}`.trim());
  }
}

/** Form submission: POST to server. */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const payload = {
    name: formData.get('name'),
    date: formData.get('date'),
    time: formData.get('time'),
    description: formData.get('description')
  };
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.ok) {
    alert(data.error || 'Failed to create task.');
    return;
  }
  form.reset();
  await loadAndRender();
});

// Initial load and polling
loadAndRender();
setInterval(loadAndRender, 20000);
