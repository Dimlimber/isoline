// Sending answers to the collection point, and keeping what could not be sent for later. Pure: fetch and storage are passed in.

// A submitter for one collection point. With no endpoint it sends nothing and keeps nothing.
// send and flush never reject: a failure of any kind leaves the payload in the queue.
export function createSubmitter({ endpoint, fetch, storage, queueKey = 'isoline.survey.queue.v1', limit = 20 }) {
  const enabled = typeof endpoint === 'string' && endpoint.trim() !== '';

  // True when the collection point took the payload: the response is ok and its JSON says ok.
  // Plain text keeps the request simple, so the browser sends it without asking the server first.
  const post = async (payload) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return false;
      const reply = await response.json();
      return reply?.ok === true;
    } catch {
      return false;
    }
  };

  // The queue is read afresh before every change, because a send may add to it while a flush is under way.
  const read = () => {
    try {
      const list = JSON.parse(storage.getItem(queueKey));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  const write = (list) => {
    try {
      storage.setItem(queueKey, JSON.stringify(list));
    } catch {
      // Storage is blocked or full: the answers themselves are still saved with the survey.
    }
  };
  const keep = (payload) => {
    const list = [...read(), payload];
    write(list.slice(Math.max(0, list.length - limit)));
  };
  const drop = (payload) => {
    const text = JSON.stringify(payload);
    const list = read();
    const at = list.findIndex((entry) => JSON.stringify(entry) === text);
    if (at === -1) return;
    list.splice(at, 1);
    write(list);
  };

  return {
    enabled,

    // 'off' with no endpoint, 'sent' when it arrived, 'queued' when it will be tried again.
    async send(payload) {
      if (!enabled) return 'off';
      if (await post(payload)) return 'sent';
      keep(payload);
      return 'queued';
    },

    // Tries every queued payload once, oldest first; resolves to the number sent.
    async flush() {
      if (!enabled) return 0;
      let sent = 0;
      for (const payload of read()) {
        if (!(await post(payload))) continue;
        drop(payload);
        sent += 1;
      }
      return sent;
    },

    // The number of payloads waiting.
    pending() {
      return read().length;
    }
  };
}
