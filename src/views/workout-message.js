import { xf, exists } from '../functions.js';

//
// <workout-message>
//
// Banner-style overlay that displays the current ZWO <textevent> message
// during a training session.
//
// Subscribes to `db:workoutMessage` which is dispatched by watch.js with a
// payload `{ message: string, ttl: number, id: number }`.
//
// - When `message` is non-empty, the banner becomes visible and starts a
//   hide-timer of `ttl` seconds (capped on the dispatch side at
//   `min(15, time-until-next-textevent)`).
// - When a new message arrives while one is showing, the timer is reset
//   and the text is swapped immediately.
// - When `message` is empty, the banner hides immediately (e.g. on
//   workout stop / done).
//
class WorkoutMessage extends HTMLElement {
    constructor() {
        super();
        this.lastId  = -1;
        this.hideTimerId = 0;
    }
    connectedCallback() {
        this.abortController = new AbortController();
        this.signal = { signal: this.abortController.signal };

        this.classList.add('workout-message');
        this.classList.add('is-hidden');

        xf.sub('db:workoutMessage', this.onMessage.bind(this), this.signal);
    }
    disconnectedCallback() {
        if(this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = 0;
        }
        this.abortController?.abort();
    }
    onMessage(payload) {
        if(!exists(payload)) return;

        // Ignore re-emits of the same payload identity (xf may broadcast
        // current value on subscribe).
        if(exists(payload.id) && payload.id === this.lastId) return;
        this.lastId = payload.id ?? this.lastId;

        const message = payload.message ?? '';

        if(this.hideTimerId) {
            clearTimeout(this.hideTimerId);
            this.hideTimerId = 0;
        }

        if(message === '') {
            this.hide();
            return;
        }

        this.show(message);

        const ttl = Math.max(1, payload.ttl ?? 15);
        this.hideTimerId = setTimeout(() => {
            this.hideTimerId = 0;
            this.hide();
        }, ttl * 1000);
    }
    show(message) {
        this.textContent = message;
        this.classList.remove('is-hidden');
    }
    hide() {
        this.textContent = '';
        this.classList.add('is-hidden');
    }
}

customElements.define('workout-message', WorkoutMessage);

export { WorkoutMessage };
