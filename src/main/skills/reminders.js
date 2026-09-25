const { Notification } = require('electron');

const activeTimers = new Map();
let nextId = 1;

function setReminder({ message, delaySeconds }) {
  const id = nextId++;
  const delayMs = Math.max(1, Number(delaySeconds)) * 1000;
  const timeout = setTimeout(() => {
    if (Notification.isSupported()) {
      new Notification({ title: 'Minals Erinnerung', body: message }).show();
    }
    activeTimers.delete(id);
  }, delayMs);
  activeTimers.set(id, { message, timeout, firesAt: Date.now() + delayMs });
  return { id, message, delaySeconds, firesAt: new Date(Date.now() + delayMs).toISOString() };
}

function listReminders() {
  return Array.from(activeTimers.entries()).map(([id, r]) => ({
    id,
    message: r.message,
    firesAt: new Date(r.firesAt).toISOString()
  }));
}

function cancelReminder({ id }) {
  const entry = activeTimers.get(Number(id));
  if (!entry) return { error: `Keine Erinnerung mit ID ${id} gefunden.` };
  clearTimeout(entry.timeout);
  activeTimers.delete(Number(id));
  return { success: true };
}

module.exports = { setReminder, listReminders, cancelReminder };
