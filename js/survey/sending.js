// When the answers are sent. A send of any kind happens only when the answers differ from those of the last send
// that was sent, queued or refused, and a send already on its way is not started again.
// Pure: the store, the submitter and the timer are passed in.
import { fingerprint } from './store.js';

// A send that was queued is tried again once, this long after, while the page is open.
const RETRY_AFTER = 30000;

// The submitter must pass how every post went to settled().
export function createSending({ store, submitter, setTimer = setTimeout }) {
  // The send on its way, as { mark, outcome }, where outcome is its promise.
  let going = null;
  let flushing = Promise.resolve(0);
  const sending = {
    // How the last send of these answers went, or will go: a promise of 'off', 'sent', 'queued' or 'refused'.
    last: null,
    send,
    flush,
    settled
  };
  return sending;

  // Sends the answers so far as this kind of send ('progress' or 'final'), unless they are those of the last send.
  function send(kind) {
    if (!submitter.enabled) {
      sending.last = Promise.resolve('off');
      return;
    }
    const mark = store.answersMark();
    const last = store.lastSend();
    if (last?.mark === mark) {
      // Nothing new to send: how the send of these answers goes, or went once what waited has been tried.
      sending.last = going?.mark === mark ? going.outcome : flushing.then(() => outcomeOf(mark, last.outcome));
      return;
    }
    // The payload is in the queue before it is posted, so until the post settles these answers are queued.
    store.markSend(mark, 'queued');
    const outcome = submitter.send({ ...store.exportAnswers(), kind });
    going = { mark, outcome };
    sending.last = outcome;
    outcome.then((result) => {
      if (going?.outcome === outcome) going = null;
      if (result === 'queued') setTimer(flush, RETRY_AFTER);
    });
  }

  // Tries again everything that waits.
  function flush() {
    flushing = submitter.flush();
    return flushing;
  }

  // Hears how a post went, from a send or from a flush. When it carried the answers of the last send, that is now how
  // the last send went, so answers that waited and have arrived since are said to be sent.
  function settled(payload, outcome) {
    const mark = fingerprint(JSON.stringify(payload.answers));
    if (store.lastSend()?.mark !== mark) return;
    sending.last = Promise.resolve(outcome);
    store.markSend(mark, outcome);
  }

  // How the send of the answers with this mark went, as the store keeps it, or `before` if another has been kept since.
  function outcomeOf(mark, before) {
    const now = store.lastSend();
    return now?.mark === mark ? now.outcome : before;
  }
}
