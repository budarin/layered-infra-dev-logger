import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createLayeredLoggerToolkit,
    createLayeredLoggers,
    type LayeredLoggerStorage,
} from '../index.js';

function createMemoryStorage(): LayeredLoggerStorage {
    const map = new Map<string, string>();
    return {
        getItem: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
        removeItem: (key) => {
            map.delete(key);
        },
        setItem: (key, value) => {
            map.set(key, value);
        },
    };
}

describe('createLayeredLoggerToolkit', () => {
    let storage: LayeredLoggerStorage;

    beforeEach(() => {
        storage = createMemoryStorage();
    });

    it('отключает и снова включает шум по selector правилу', () => {
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
        const toolkit = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: true, storage, storageKey: 'logger-tests' },
        });
        const logger = toolkit.createLogger().child('core').child('usecase');

        logger.debug('до отключения');
        toolkit.control.disable('[ CORE ][ USECASE ] | debug');
        logger.debug('после отключения');
        toolkit.control.enable('[ CORE ][ USECASE ] | debug');
        logger.debug('после повторного включения');

        expect(debugSpy).toHaveBeenCalledTimes(2);
        debugSpy.mockRestore();
    });

    it('сопоставляет scope по смыслу, а не по пробелам', () => {
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
        const toolkit = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: false },
        });
        const logger = toolkit.createLogger().child('CORE').child('USECASE');

        toolkit.control.disable('[ C O R E ][ U S E C A S E ] | debug');
        logger.debug('этот лог должен быть заглушен');

        expect(debugSpy).toHaveBeenCalledTimes(0);
        debugSpy.mockRestore();
    });

    it('восстанавливает режим и правила из persistence storage', () => {
        const toolkitA = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: true, storage, storageKey: 'logger-tests' },
        });
        toolkitA.control.disable('*');
        toolkitA.control.enable('[ CORE ][ USECASE ] | debug | * | *"code":"E_TIMEOUT"*');

        const toolkitB = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: true, storage, storageKey: 'logger-tests' },
        });

        expect(toolkitB.control.showMode()).toBe('all-disabled');
        expect(toolkitB.control.show('enabled')).toHaveLength(1);
    });

    it('создает именованные логгеры из layers-конфига с alias у узлов', () => {
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
        const toolkit = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: false },
        });
        const baseLogger = toolkit.createLogger();

        const named = createLayeredLoggers(baseLogger, {
            APP: {
                children: {
                    CORE: {
                        children: {
                            USECASE: { alias: 'coreUseCaseLogger', color: '#ea580c' },
                        },
                        color: '#c2410c',
                    },
                    UI: { alias: 'uiLogger', color: '#16a34a' },
                },
                color: '#b45309',
            },
        });

        named.coreUseCaseLogger.debug('test');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        debugSpy.mockRestore();
    });

    it('наследует цвет родителя, если у узла цвет не указан', () => {
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
        const toolkit = createLayeredLoggerToolkit({
            globalControl: { enabled: false },
            persistence: { enabled: false },
        });
        const baseLogger = toolkit.createLogger();
        const named = createLayeredLoggers(baseLogger, {
            APP: {
                alias: 'appLogger',
                children: {
                    SERVICE: {
                        color: '#2563eb',
                        children: {
                            THEME: { alias: 'themeServiceLogger' },
                        },
                    },
                },
                color: '#b45309',
            },
        });

        named.themeServiceLogger.debug('theme inherited color');

        expect(debugSpy).toHaveBeenCalledWith(
            '%c[ APP ]%c %c[ SERVICE ]%c %c[ THEME ]%c ',
            'color: #b45309; font-weight: 700;',
            'font-weight: inherit; color: inherit;',
            'color: #2563eb; font-weight: 700;',
            'font-weight: inherit; color: inherit;',
            'color: #2563eb; font-weight: 700;',
            'font-weight: inherit; color: inherit;',
            'theme inherited color'
        );
        debugSpy.mockRestore();
    });
});
