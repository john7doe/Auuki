/**
 * @jest-environment jsdom
 */

import { isoDate, } from '../src/utils.js';

// These tests are timezone independent:
// - For `local = true`, isoDate reads the local date components, so inputs are
//   built with the numeric Date constructor (interpreted in local time). The
//   same local components are read back regardless of the machine timezone.
// - For `local = false`, isoDate returns the UTC date via toISOString(), so
//   inputs are built with explicit UTC instants (the `Z` suffix), which are
//   deterministic regardless of the machine timezone.

describe('isoDate', () => {
    describe('local = true (local calendar date)', () => {
        test('returns the local date', () => {
            const localDate = new Date(2025, 1, 25, 0, 0, 0);
            expect(isoDate(localDate)).toBe('2025-02-25');
        });

        test('late evening stays on the same local day', () => {
            const localDate = new Date(2025, 1, 24, 23, 0, 0);
            expect(isoDate(localDate)).toBe('2025-02-24');
        });

        test('just after midnight is the next local day', () => {
            const localDate = new Date(2025, 1, 25, 0, 30, 0);
            expect(isoDate(localDate)).toBe('2025-02-25');
        });

        test('pads single digit month and day', () => {
            const localDate = new Date(2025, 0, 5, 12, 0, 0);
            expect(isoDate(localDate)).toBe('2025-01-05');
        });
    });

    describe('local = false (UTC calendar date)', () => {
        test('returns the UTC date', () => {
            const date = new Date('2025-02-25T00:00:00Z');
            expect(isoDate(date, false)).toBe('2025-02-25');
        });

        test('late UTC evening stays on the same UTC day', () => {
            const date = new Date('2025-02-24T22:00:00Z');
            expect(isoDate(date, false)).toBe('2025-02-24');
        });

        test('just after UTC midnight is the next UTC day', () => {
            const date = new Date('2025-02-25T00:30:00Z');
            expect(isoDate(date, false)).toBe('2025-02-25');
        });
    });
});
