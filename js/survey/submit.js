// Sending answers to the collection point, and keeping what could not be sent for later.
// Pure: fetch, storage and the timer are passed in.

const QUEUE_KEY = 'isoline.survey.queue.v1';
// A post with no reply by then is given up; its payload waits in the queue.
const TIMEOUT = 15000;

// The number of payloads waiting in the queue kept under queueKey.
export function queueLength(storage, queueKey = QUEUE_KEY) {
  return readQueue(storage, queueKey).length;
}

// A submitter for one collection point. With no endpoint it sends nothing and keeps nothing.
// A payload waits in the queue from before it is posted until it has arrived or was refused for good, so a send cut
// off by closing the page is tried again later. send and flush never reject. onSettle(payload, outcome) hears how
// every post went.
export function createSubmitter({ endpoint, fetch, storage, queueKey = QUEUE_KEY, limit = 20, timeout = TIMEOUT, setTimer = setTimeout, clearTimer = clearTimeout, onSettle = () => {} }) {
  const enabled = typeof endpoint === 'string' && endpoint.trim() !== '';
  // The payloads being posted now, by their text, so that a flush does not post one a second time.
  const posting = new Set();
  let flushing = null;

  // 'sent' when the collection point took the payload: the response is ok and its JSON says ok. 'refused' when its
  // JSON says never to try again (drop). 'queued' for any other outcome.
  // Plain text keeps the request simple, so the browser sends it without asking the server first.
  const attempt = async (payload, signal) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal
      });
      if (!response.ok) return 'queued';
      const reply = await response.json();
      if (reply?.ok === true) return 'sent';
      return reply?.drop === true ? 'refused' : 'queued';
    } catch {
      return 'queued';
    }
  };

  // The outcome of one post, or 'queued' once the time allowed has passed, whether or not the request stops.
  const post = (payload) => new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimer(() => {
      controller.abort();
      resolve('queued');
    }, timeout);
    attempt(payload, controller.signal).then((outcome) => {
      clearTimer(timer);
      resolve(outcome);
    });
  });

  // The queue is read afresh before every change, because a send may add to it while a flush is under way.
  const read = () => readQueue(storage, queueKey);
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
  const drop = (text) => {
    const list = read();
    const at = list.findIndex((entry) => JSON.stringify(entry) === text);
    if (at === -1) return;
    list.splice(at, 1);
    write(list);
  };

  // Posts a payload that waits in the queue, and takes it out once it has arrived or was refused for good.
  const deliver = async (payload) => {
    const text = JSON.stringify(payload);
    posting.add(text);
    const outcome = await post(payload);
    posting.delete(text);
    if (outcome !== 'queued') drop(text);
    onSettle(payload, outcome);
    return outcome;
  };

  // Every payload that waits, once, oldest first, except those being posted now; resolves to the number sent.
  const run = async () => {
    let sent = 0;
    for (const payload of read()) {
      if (posting.has(JSON.stringify(payload))) continue;
      if (await deliver(payload) === 'sent') sent += 1;
    }
    return sent;
  };

  return {
    enabled,

    // 'off' with no endpoint; otherwise 'sent' when it arrived, 'refused' when it will never be taken, and 'queued'
    // when it will be tried again.
    async send(payload) {
      if (!enabled) return 'off';
      keep(payload);
      return deliver(payload);
    },

    // Tries every queued payload once, oldest first; resolves to the number sent. A flush asked for while one is under
    // way is that same flush.
    flush() {
      if (!enabled) return Promise.resolve(0);
      flushing ??= run().finally(() => { flushing = null; });
      return flushing;
    },

    // The number of payloads waiting.
    pending() {
      return read().length;
    }
  };
}

// The payloads waiting under queueKey; a queue that cannot be read counts as empty.
function readQueue(storage, queueKey) {
  try {
    const list = JSON.parse(storage.getItem(queueKey));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
