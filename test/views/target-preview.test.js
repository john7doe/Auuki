/**
 * @jest-environment jsdom
 */

import { xf } from '../../src/functions.js';
import { models } from '../../src/models/models.js';
import '../../src/views/data-views.js';

describe('Workout target previews', () => {
    test('target previews render updates and clear when the workout ends', () => {
        const cases = [
            ['power-target-preview', 'powerTargetPreview', 240, '→ 240'],
            ['cadence-target-preview', 'cadenceTargetPreview', 90, '→ 90'],
            ['slope-target-preview', 'slopeTargetPreview', 4.8, '→ 4.8'],
        ];

        for(const [tag, prop, value, text] of cases) {
            const element = document.createElement(tag);
            document.body.append(element);

            xf.dispatch(`db:${prop}`, {[prop]: {value, secondsUntil: 15}});
            expect(element.textContent).toBe(text);

            xf.dispatch(`db:${prop}`, {[prop]: null});
            expect(element.textContent).toBe('');
            element.remove();
        }
    });

    describe('Intervals.icu API-key controls', () => {
        test('connect uses the supplied key and disconnect clears it', async () => {
            await models.api.intervals.disconnect();
            const controls = document.createElement('o-auth');
            controls.innerHTML = `
                <button id="intervals--connect--button"></button>
                <input id="intervals--api-key--input">
            `;
            document.body.append(controls);
            const input = controls.querySelector('input');
            input.value = 'test-api-key';

            controls.onAction(':intervals');
            expect(models.api.intervals.getKey()).toBe('test-api-key');

            controls.onAction(':intervals');
            expect(models.api.intervals.hasKey()).toBe(false);
            expect(input.value).toBe('');
            controls.remove();
        });
    });

    test('upstream text-event overlay and target preview update independently', () => {
        const cue = document.createElement('workout-text-event');
        const preview = document.createElement('cadence-target-preview');
        document.body.append(cue, preview);

        xf.dispatch('db:workoutTextEvent', {workoutTextEvent: 'Spin faster'});
        xf.dispatch('db:cadenceTargetPreview', {
            cadenceTargetPreview: {value: 0, secondsUntil: 10},
        });

        expect(cue.textContent).toBe('Spin faster');
        expect(cue.classList.contains('active')).toBe(true);
        expect(preview.textContent).toBe('→ –');

        xf.dispatch('db:workoutTextEvent', {workoutTextEvent: ''});
        expect(cue.classList.contains('active')).toBe(false);
        expect(preview.textContent).toBe('→ –');

        cue.remove();
        preview.remove();
    });
});
