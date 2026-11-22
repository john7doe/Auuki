import { transformFileSync } from '@babel/core';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

test('configuration initializes in a browser without the Node process global', () => {
    const { code } = transformFileSync(resolve(__dirname, '../../src/models/config.js'));
    const browser = {
        window: {location: {origin: 'https://example.com'}},
        exports: {},
    };

    expect(() => runInNewContext(code, browser)).not.toThrow();
});
