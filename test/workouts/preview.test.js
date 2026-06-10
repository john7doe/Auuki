import { findNextChange, fieldEquals } from '../../src/workouts/preview.js';

const W = (intervals) => intervals;

describe('findNextChange', () => {

    test('power: change within 15s returns value + secondsUntil', () => {
        const intervals = W([
            { duration: 30, steps: [
                { duration: 10, power: 0.5 },
                { duration: 20, power: 0.8 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 5,
            field: 'power',
        });

        expect(r).toEqual({ value: 0.8, secondsUntil: 5 });
    });

    test('power: change beyond 15s returns null', () => {
        const intervals = W([
            { duration: 50, steps: [
                { duration: 30, power: 0.5 },
                { duration: 20, power: 0.8 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 20, // 20s left, next change at 20s > 15s horizon
            field: 'power',
        });

        expect(r).toBe(null);
    });

    test('power: same value across step boundary keeps walking', () => {
        const intervals = W([
            { duration: 30, steps: [
                { duration: 10, power: 0.5 },
                { duration: 5,  power: 0.5 }, // same value, advance past
                { duration: 15, power: 0.9 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 4,
            field: 'power',
        });
        // boundary 1 at 4s (same), boundary 2 at 4+5=9s (different) → preview
        expect(r).toEqual({ value: 0.9, secondsUntil: 9 });
    });

    test('cadence: from undefined to 90 reports value 90', () => {
        const intervals = W([
            { duration: 60, steps: [
                { duration: 20, power: 0.6 }, // no cadence
                { duration: 40, power: 0.6, cadence: 90 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 10,
            field: 'cadence',
        });

        expect(r).toEqual({ value: 90, secondsUntil: 10 });
    });

    test('cadence: from 90 to undefined reports value 0', () => {
        const intervals = W([
            { duration: 60, steps: [
                { duration: 20, power: 0.6, cadence: 90 },
                { duration: 40, power: 0.6 }, // cadence cleared
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 5,
            field: 'cadence',
        });

        expect(r).toEqual({ value: 0, secondsUntil: 5 });
    });

    test('slope: change within horizon returns float value', () => {
        const intervals = W([
            { duration: 60, steps: [
                { duration: 30, slope: 2.0 },
                { duration: 30, slope: 4.8 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 12,
            field: 'slope',
        });

        expect(r).toEqual({ value: 4.8, secondsUntil: 12 });
    });

    test('end of workout reached without change returns null', () => {
        const intervals = W([
            { duration: 30, steps: [
                { duration: 10, power: 0.5 },
                { duration: 20, power: 0.5 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 5,
            field: 'power',
        });

        expect(r).toBe(null);
    });

    test('crosses into next interval', () => {
        const intervals = W([
            { duration: 20, steps: [
                { duration: 20, power: 0.5 },
            ]},
            { duration: 40, steps: [
                { duration: 40, power: 0.9 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 8,
            field: 'power',
        });

        expect(r).toEqual({ value: 0.9, secondsUntil: 8 });
    });

    test('respects custom horizonSec', () => {
        const intervals = W([
            { duration: 60, steps: [
                { duration: 25, power: 0.5 },
                { duration: 35, power: 0.9 },
            ]},
        ]);

        // Change at stepTime=20s. With default 15 → null. With 30 → match.
        expect(findNextChange({
            intervals, intervalIndex: 0, stepIndex: 0, stepTime: 20,
            field: 'power',
        })).toBe(null);

        expect(findNextChange({
            intervals, intervalIndex: 0, stepIndex: 0, stepTime: 20,
            field: 'power', horizonSec: 30,
        })).toEqual({ value: 0.9, secondsUntil: 20 });
    });

    test('handles stepTime = 0 (boundary moment)', () => {
        const intervals = W([
            { duration: 30, steps: [
                { duration: 10, power: 0.5 },
                { duration: 20, power: 0.8 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 0,
            stepTime: 0,
            field: 'power',
        });

        expect(r).toEqual({ value: 0.8, secondsUntil: 0 });
    });

    test('returns null gracefully for empty or invalid input', () => {
        expect(findNextChange({
            intervals: [], intervalIndex: 0, stepIndex: 0, stepTime: 5,
            field: 'power',
        })).toBe(null);

        expect(findNextChange({
            intervals: null, intervalIndex: 0, stepIndex: 0, stepTime: 5,
            field: 'power',
        })).toBe(null);

        expect(findNextChange({
            intervals: [{ steps: [] }],
            intervalIndex: 0, stepIndex: 0, stepTime: 5, field: 'power',
        })).toBe(null);
    });

    test('last step in last interval returns null', () => {
        const intervals = W([
            { duration: 60, steps: [
                { duration: 20, power: 0.5 },
                { duration: 40, power: 0.8 },
            ]},
        ]);

        const r = findNextChange({
            intervals,
            intervalIndex: 0,
            stepIndex: 1,
            stepTime: 10,
            field: 'power',
        });

        expect(r).toBe(null);
    });
});

describe('fieldEquals', () => {
    test('power compares fractional with tolerance', () => {
        expect(fieldEquals('power', 0.5, 0.5000001)).toBe(true);
        expect(fieldEquals('power', 0.5, 0.6)).toBe(false);
        expect(fieldEquals('power', undefined, 0)).toBe(true);
        expect(fieldEquals('power', undefined, undefined)).toBe(true);
    });

    test('cadence integer compare; undefined treated as 0', () => {
        expect(fieldEquals('cadence', undefined, 0)).toBe(true);
        expect(fieldEquals('cadence', 90, 90)).toBe(true);
        expect(fieldEquals('cadence', 90, 91)).toBe(false);
    });

    test('slope compares with 1e-3 tolerance', () => {
        expect(fieldEquals('slope', 2.0, 2.0005)).toBe(true);
        expect(fieldEquals('slope', 2.0, 2.1)).toBe(false);
        expect(fieldEquals('slope', undefined, 0)).toBe(true);
    });
});
