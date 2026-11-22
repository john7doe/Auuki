/**
 * @jest-environment jsdom
 */

import { xf } from '../../src/functions.js';
import auth from '../../src/models/auth.js';
import intervals from '../../src/models/intervals.js';

describe('Managed API compatibility', () => {
    const originalFetch = global.fetch;
    let actions;
    let controller;
    let db;

    xf.reg('services', (services, state) => {
        state.services = {...state.services, ...services};
    });

    beforeEach(async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        global.fetch = jest.fn();
        Object.defineProperty(navigator, 'bluetooth', {value: {}, configurable: true});
        Object.defineProperty(navigator, 'wakeLock', {value: {}, configurable: true});
        db = {services: {strava: false, intervals: false, trainingPeaks: false}};
        xf.create(db);
        await intervals.disconnect();
        actions = [];
        controller = new AbortController();
        xf.sub('action:auth', action => actions.push(action), {signal: controller.signal});
    });

    afterEach(() => {
        controller.abort();
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    const statusResponse = {
        ok: true,
        status: 200,
        json: async () => ({
            result: {
                services: {},
                strava: false,
                intervals: false,
                trainingPeaks: false,
            },
        }),
    };

    test('registration returns to login without requiring email verification', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({result: {success: true}}),
        });

        await auth.register({data: {
            email: 'athlete@example.com',
            password: 'test-password',
            password_confirmation: 'test-password',
        }});

        expect(fetch).toHaveBeenCalledWith('/api/register', expect.any(Object));
        expect(actions).toContain(':password:login');
        expect(actions).not.toContain(':password:verify-sent');
    });

    test('backend status cannot overwrite the local Intervals.icu key connection', async () => {
        await intervals.connect('test-api-key');
        fetch.mockResolvedValue(statusResponse);

        await auth.status();

        expect(fetch).toHaveBeenCalledWith('/api/rpc', expect.objectContaining({
            credentials: 'include',
        }));
        expect(db.services.intervals).toBe(true);
        expect(actions).toContain(':password:profile');
    });

    test('logout accepts the existing backend success payload', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({result: {success: true}}),
            })
            .mockResolvedValue(statusResponse);

        await auth.logout();

        expect(fetch).toHaveBeenCalledWith('/api/logout', expect.objectContaining({
            credentials: 'include',
        }));
        expect(actions).toContain(':password:logout');
        expect(actions).not.toContain(':error');
    });
});
