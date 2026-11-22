const { verify } = require('../../api/shared/turnstile.js');

describe('Turnstile verification', () => {
    const originalFetch = global.fetch;
    const originalSecret = process.env.TURNSTILE_SECRET;

    beforeEach(() => {
        process.env.TURNSTILE_SECRET = 'test-secret';
        global.fetch = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        if(originalSecret === undefined) delete process.env.TURNSTILE_SECRET;
        else process.env.TURNSTILE_SECRET = originalSecret;
        jest.restoreAllMocks();
    });

    test('forwards only the client IP, not the forwarded proxy chain', async () => {
        fetch.mockResolvedValue({ok: true, json: async () => ({success: true})});

        expect(await verify('test-token', '203.0.113.10, 198.51.100.20'))
            .toEqual({success: true});
        const form = new URLSearchParams(fetch.mock.calls[0][1].body);
        expect(form.get('remoteip')).toBe('203.0.113.10');
    });

    test('omits malformed optional IP metadata', async () => {
        fetch.mockResolvedValue({ok: true, json: async () => ({success: true})});

        await verify('test-token', 'unknown');

        expect(new URLSearchParams(fetch.mock.calls[0][1].body).has('remoteip')).toBe(false);
    });

    test('reports provider failure codes without exposing the token or secret', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({success: false, 'error-codes': ['invalid-input-secret']}),
        });

        expect(await verify('test-token')).toEqual({
            success: false,
            codes: ['invalid-input-secret'],
        });
        const logged = JSON.stringify(console.error.mock.calls);
        expect(logged).not.toContain('test-token');
        expect(logged).not.toContain('test-secret');
    });

    test('rejects an empty token before calling the provider', async () => {
        expect(await verify('')).toEqual({
            success: false,
            codes: ['missing-input-response'],
        });
        expect(fetch).not.toHaveBeenCalled();
    });
});
