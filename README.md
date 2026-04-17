# layered-infra-dev-logger

Infrastructure-focused dev logger toolkit for layered architectures.

## Features

- Colored scope prefixes in console logs (`[ UI ] [ CONTAINER ] ...`).
- Runtime noise control with rules:
    - `enable/disable/show/remove/preview/focus/reset/undo`.
- Selector DSL with scope + level + message + args matching:
    - `[ scopes ] | levels | message | args`.
- `glob` and `eq:` matchers for `message` and `args`.
- Optional persistence via `localStorage` or custom storage adapter.
- Optional global control attachment (`globalThis.logger` by default).

## Install

```bash
pnpm add layered-infra-dev-logger
```

## Quick Start

```ts
import { createLayeredLoggerToolkit } from 'layered-infra-dev-logger';

// Defaults already enabled:
// - global control in DevTools console: globalThis.logger
// - persistence in localStorage
// - scope normalize: trim spaces + uppercase
const toolkit = createLayeredLoggerToolkit();

const base = toolkit.createLogger();
const coreLogger = base.child('CORE').child('USECASE', { color: '#ea580c' });

coreLogger.debug('sync failed', { code: 'E_TIMEOUT', todoId: '019...' });
```

## Layered Project Setup (Composition Root)

```ts
import { createLayeredLoggerToolkit, createLayeredLoggers } from 'layered-infra-dev-logger';

// 1) Create one toolkit in bootstrap/composition root.
const toolkit = createLayeredLoggerToolkit();

// 2) Describe your layered structure once.
const baseLogger = toolkit.createLogger();
const {
    logger,
    uiLogger,
    uiContainerLogger,
    coreLogger,
    coreUseCaseLogger,
    coreAdapterLogger,
    storeLogger,
    serviceLogger,
    networkServiceLogger,
    themeServiceLogger,
} = createLayeredLoggers(baseLogger, {
    APP: {
        alias: 'logger',
        color: '#b45309',
        children: {
            UI: {
                alias: 'uiLogger',
                color: '#16a34a',
                children: {
                    CONTAINER: { alias: 'uiContainerLogger', color: '#22c55e' },
                },
            },
            CORE: {
                alias: 'coreLogger',
                color: '#c2410c',
                children: {
                    USECASE: { alias: 'coreUseCaseLogger', color: '#ea580c' },
                    ADAPTER: { alias: 'coreAdapterLogger', color: '#f59e0b' },
                },
            },
            STORE: { alias: 'storeLogger', color: '#dc2626' },
            SERVICE: {
                alias: 'serviceLogger',
                color: '#2563eb',
                children: {
                    NETWORK: { alias: 'networkServiceLogger', color: '#38bdf8' },
                    THEME: { alias: 'themeServiceLogger' }, // inherits SERVICE color
                },
            },
        },
    },
});

// 3) Wire them into your app boundaries/ports.
initUiLoggerPort(uiLogger);
initUiContainerLoggerPort(uiContainerLogger);
initCoreUseCaseLoggerPort(coreUseCaseLogger);
initCoreAdapterLoggerPort(coreAdapterLogger);
initStoreLoggerPort(storeLogger);
initServiceLoggerPort(serviceLogger);

// 4) Use in runtime code.
coreUseCaseLogger.debug('create todo start', { todoId: '019...' });
networkServiceLogger.warn('network degraded', { quality: 'slow-2g' });

// 5) Manual variant: same idea via child() chain.
const manualCoreUseCaseLogger = baseLogger
    .child('APP', { color: '#b45309' })
    .child('CORE', { color: '#c2410c' })
    .child('USECASE', { color: '#ea580c' });

manualCoreUseCaseLogger.debug('same logger built manually with child()');
```

### Why this pattern matters

- You keep one source of truth for logger config and rule state.
- Every layer gets stable scope prefixes and colors.
- Alias is configured directly on each layer node, so no second `aliases` config is needed.
- If `color` is omitted on a node, it inherits nearest parent color automatically.
- Noise-control rules can target architecture boundaries directly:
    - `[ CORE ][ USECASE ] | debug | * | *`
    - `[ SERVICE ][ NETWORK ] | warn,error | * | *`
    - `[ UI ][ CONTAINER ][ * ] | debug | *render* | *`

## DevTools Console Control API

`Control API` is intended for runtime debugging directly in browser console (`globalThis.logger` by default).

```ts
// mode and rules
logger.showMode();
logger.show('all');

// disable by selector
logger.previewDisable('[ CORE ][ USECASE ] | debug | * | *"code":"E_TIMEOUT"*');
logger.disable('[ CORE ][ USECASE ] | debug | * | *"code":"E_TIMEOUT"*');

// re-enable
logger.enable('[ CORE ][ USECASE ] | debug | * | *"code":"E_TIMEOUT"*');

// remove by id
logger.remove(3);

// remove by selector
logger.previewRemove('[ CORE ][ * ]');
logger.remove('[ CORE ][ * ]');

// focus, reset, undo
logger.focus('[ UI ][ CONTAINER ][ * ] | debug');
logger.reset();
logger.undo();
```

## Advanced Options (optional)

Use these only if defaults do not fit your project.

```ts
const toolkit = createLayeredLoggerToolkit({
    mode: 'all-disabled',
    scope: {
        // default normalize is already "remove spaces + uppercase"
        normalize: (segment) => segment.trim().toLowerCase(),
    },
    persistence: {
        enabled: false, // default is true
    },
    globalControl: {
        enabled: false, // default is true
        key: 'devLogger',
    },
});

// 2b) You can also build loggers manually with child() when needed.
const manualCoreUseCaseLogger = baseLogger
    .child('APP', { color: '#b45309' })
    .child('CORE', { color: '#c2410c' })
    .child('USECASE', { color: '#ea580c' });

manualCoreUseCaseLogger.debug('manual chain logger is also valid');
```

## Selector DSL

`[ scopes ] | levels | message | args`

- `scopes`: required (`[ CORE ][ USECASE ]`), prefix mode via `[ * ]` tail.
- `levels`: optional (`debug,warn`), default `*`.
- `message`: optional (`*retry*`, `eq:Sync failed`), default `*`.
- `args`: optional (`*"code":"E_TIMEOUT"*`, `eq:{"code":"E_TIMEOUT"}`), default `*`.

Examples:

- `[ CORE ][ USECASE ]`
- `[ CORE ][ USECASE ][ * ] | debug,warn`
- `[ UI ][ * ] | * | *retry*`
- `[ CORE ][ USECASE ] | debug | * | *"code":"E_TIMEOUT"*`

## Notes

- This package is intended for development-time logging and filtering.
- State persistence is best-effort; invalid or broken storage payload is auto-reset.
