import { describe, expect, it, vi } from 'vitest';

import { createLayeredLoggerToolkit, type LayeredLoggerStorage } from '../index.js';

function restoreGlobalProperty(key: string, descriptor: PropertyDescriptor | undefined): void {
    if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, key);
        return;
    }

    Object.defineProperty(globalThis, key, descriptor);
}

describe('service-worker-like runtime (no window on globalThis)', () => {
    it('createLayeredLoggerToolkit() does not throw', () => {
        const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Reflect.deleteProperty(globalThis, 'window');
        try {
            expect(() =>
                createLayeredLoggerToolkit({
                    globalControl: { enabled: false },
                    persistence: { enabled: false },
                })
            ).not.toThrow();
        } finally {
            restoreGlobalProperty('window', windowDescriptor);
        }
    });

    it('createLogger().child(...).debug(...) does not throw', () => {
        const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Reflect.deleteProperty(globalThis, 'window');
        try {
            const toolkit = createLayeredLoggerToolkit({
                globalControl: { enabled: false },
                persistence: { enabled: false },
            });
            expect(() => toolkit.createLogger().child('CORE').debug('ok')).not.toThrow();
        } finally {
            restoreGlobalProperty('window', windowDescriptor);
        }
    });
});

describe('node-like runtime (no localStorage)', () => {
    it('toolkit is created and persistence is silently disabled when localStorage is absent', () => {
        const lsDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Reflect.deleteProperty(globalThis, 'localStorage');
        try {
            const toolkitA = createLayeredLoggerToolkit({
                globalControl: { enabled: false },
                persistence: { enabled: true },
            });
            toolkitA.control.disable('*');

            const toolkitB = createLayeredLoggerToolkit({
                globalControl: { enabled: false },
                persistence: { enabled: true },
            });

            expect(toolkitB.control.showMode()).toBe('all-enabled');
            expect(toolkitB.control.show()).toHaveLength(0);
        } finally {
            restoreGlobalProperty('localStorage', lsDescriptor);
        }
    });
});

describe('global control attachment', () => {
    it('registers control on a browser-like target when defineProperty succeeds', () => {
        const key = '__layeredInfraDevLoggerControlTest__';
        const target: Record<string, unknown> = {};
        const toolkit = createLayeredLoggerToolkit({
            globalControl: { enabled: true, key, target },
            persistence: { enabled: false },
        });
        expect(target[key]).toBe(toolkit.control);
        Reflect.deleteProperty(target, key);
    });

    it('does not throw when defineProperty cannot attach (best effort)', () => {
        const key = '__layeredInfraDevLoggerDupKey__';
        const target: Record<string, unknown> = {};
        Object.defineProperty(target, key, {
            configurable: false,
            enumerable: true,
            value: 'occupied',
            writable: false,
        });

        expect(() =>
            createLayeredLoggerToolkit({
                globalControl: { enabled: true, key, target },
                persistence: { enabled: false },
            })
        ).not.toThrow();
    });
});

describe('persistence errors stay internal', () => {
    it('hydration does not throw when storage.getItem throws', () => {
        const storage: LayeredLoggerStorage = {
            getItem: () => {
                throw new Error('storage read failed');
            },
            removeItem: vi.fn(),
            setItem: vi.fn(),
        };

        expect(() =>
            createLayeredLoggerToolkit({
                globalControl: { enabled: false },
                persistence: { enabled: true, storage, storageKey: 'bad-read-key' },
            })
        ).not.toThrow();
    });
});

describe('regression: no window global binding', () => {
    it('toolkit with global control enabled does not throw when window is missing from globalThis', () => {
        const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
        const controlKey = '__layeredInfraSwGlobalRegression__';
        Reflect.deleteProperty(globalThis, 'window');
        try {
            expect(() =>
                createLayeredLoggerToolkit({
                    globalControl: { enabled: true, key: controlKey },
                    persistence: { enabled: false },
                })
            ).not.toThrow();
            expect(Reflect.get(globalThis, controlKey)).toBeDefined();
            Reflect.deleteProperty(globalThis, controlKey);
        } finally {
            restoreGlobalProperty('window', windowDescriptor);
        }
    });
});
