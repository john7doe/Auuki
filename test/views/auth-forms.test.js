/**
 * @jest-environment jsdom
 */

import { models } from '../../src/models/models.js';
import { xf } from '../../src/functions.js';
import '../../src/views/auth-forms.js';

jest.mock('../../src/models/models.js', () => ({
    models: {api: {auth: {
        login: jest.fn(),
        register: jest.fn(),
        resetTurnstile: jest.fn(),
        logout: jest.fn(),
    }}},
}));

describe('Authentication challenge lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <button id="logout--button"></button>
            <div id="profile"></div>
            <div id="auth-error--section"></div>
        `;
        const element = document.createElement('auth-forms');
        element.innerHTML = ['login', 'register', 'forgot', 'reset'].map(method => `
            <form id="${method}--form">
                <input name="email" value="athlete@example.com">
                <input name="password" type="password" value="test-password">
                <button>Submit</button>
            </form>
        `).join('');
        document.body.append(element);
        window.turnstile = {getResponse: jest.fn()};
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.turnstile;
    });

    test.each(['login', 'register'])('blocks %s until the challenge is complete', method => {
        window.turnstile.getResponse.mockReturnValue('');
        const form = document.querySelector(`#${method}--form`);

        form.dispatchEvent(new Event('submit', {cancelable: true}));

        expect(models.api.auth[method]).not.toHaveBeenCalled();
        expect(document.querySelector('#auth-error--section').textContent)
            .toContain('Complete the anti-bot check');
        expect(form.elements.password.value).toBe('test-password');
    });

    test('refreshes the challenge after a rejected login and preserves the form', async () => {
        window.turnstile.getResponse.mockReturnValue('test-token');
        models.api.auth.login.mockResolvedValue(false);
        const form = document.querySelector('#login--form');

        form.dispatchEvent(new Event('submit', {cancelable: true}));
        await Promise.resolve();

        expect(models.api.auth.resetTurnstile).toHaveBeenCalledTimes(1);
        expect(form.elements.email.value).toBe('athlete@example.com');
        expect(form.elements.password.value).toBe('test-password');
        expect(form.querySelector('button').disabled).toBe(false);
    });

    test('prevents concurrent submissions from reusing the same challenge', async () => {
        window.turnstile.getResponse.mockReturnValue('test-token');
        let finish;
        models.api.auth.login.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
        const form = document.querySelector('#login--form');

        form.dispatchEvent(new Event('submit', {cancelable: true}));
        form.dispatchEvent(new Event('submit', {cancelable: true}));

        expect(models.api.auth.login).toHaveBeenCalledTimes(1);
        expect(form.querySelector('button').disabled).toBe(true);
        finish(false);
        await Promise.resolve();
        expect(models.api.auth.resetTurnstile).toHaveBeenCalledTimes(1);
    });

    test('Turnstile rejection is not described as incorrect credentials', () => {
        xf.dispatch('action:auth', ':turnstile:error');

        expect(document.querySelector('#auth-error--section').textContent)
            .toContain('Complete the refreshed check');
        expect(document.querySelector('#login--form').elements.password.value)
            .toBe('test-password');
    });
});
