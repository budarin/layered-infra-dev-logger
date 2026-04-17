export type LoggerMethodName = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type LayeredLoggerRuleKind = 'enabled' | 'disabled';
export type LayeredLoggerRuleListKind = LayeredLoggerRuleKind | 'all';
export type LayeredLoggerBaselineMode = 'all-enabled' | 'all-disabled';
export type LayeredLoggerScopeMatchMode = 'exact' | 'prefix';
export type LayeredLoggerTextMatchMode = 'glob' | 'exact';

export type LayeredLoggerTextMatcher = {
    readonly mode: LayeredLoggerTextMatchMode;
    readonly pattern: string;
};

export type LayeredLoggerSelector = {
    readonly args: LayeredLoggerTextMatcher;
    readonly levels: readonly LoggerMethodName[] | '*';
    readonly message: LayeredLoggerTextMatcher;
    readonly scopeMatchMode: LayeredLoggerScopeMatchMode;
    readonly scopeSegments: readonly string[];
    readonly source: string;
};

type LayeredLoggerRule = {
    readonly createdAtMs: number;
    readonly hits: number;
    readonly id: number;
    readonly kind: LayeredLoggerRuleKind;
    readonly lastMatchedAtMs?: number;
    readonly selector: LayeredLoggerSelector;
};

export type LayeredLoggerRuleView = {
    readonly createdAtIso: string;
    readonly hits: number;
    readonly id: number;
    readonly kind: LayeredLoggerRuleKind;
    readonly lastMatchedAtIso?: string;
    readonly selector: string;
};

export type LayeredLoggerRemovePreview = {
    readonly matchedCount: number;
    readonly matchedIds: readonly number[];
    readonly rules: readonly LayeredLoggerRuleView[];
};

export type LayeredLoggerMatchPreview = {
    readonly overriddenRuleIds: readonly number[];
    readonly wouldAffect: boolean;
};

export type LayeredLoggerRemoveTarget = number | readonly number[] | string;

export type LayeredLoggerControl = {
    clear(kind?: LayeredLoggerRuleListKind): LayeredLoggerRemovePreview;
    disable(input: string): LayeredLoggerRuleView | undefined;
    enable(input: string): LayeredLoggerRuleView | undefined;
    focus(input: string): LayeredLoggerRuleView | undefined;
    previewDisable(input: string): LayeredLoggerMatchPreview;
    previewEnable(input: string): LayeredLoggerMatchPreview;
    previewRemove(target: LayeredLoggerRemoveTarget): LayeredLoggerRemovePreview;
    remove(target: LayeredLoggerRemoveTarget): LayeredLoggerRemovePreview;
    reset(): LayeredLoggerRemovePreview;
    shoMode(): LayeredLoggerBaselineMode;
    show(kind?: LayeredLoggerRuleListKind): readonly LayeredLoggerRuleView[];
    showMode(): LayeredLoggerBaselineMode;
    undo(): boolean;
};

export type LayeredLogger = {
    child(segment: string, options?: LayeredLoggerScopeOptions): LayeredLogger;
    debug(...args: readonly unknown[]): void;
    error(...args: readonly unknown[]): void;
    info(...args: readonly unknown[]): void;
    scope(segment: string, options?: LayeredLoggerScopeOptions): LayeredLogger;
    trace(...args: readonly unknown[]): void;
    warn(...args: readonly unknown[]): void;
};

export type LayeredLoggerScopeOptions = {
    readonly color?: string;
};

export type LayeredLoggerStorage = {
    getItem(key: string): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
};

export type LayeredLoggerScopeContext = {
    readonly index: number;
    readonly parentColor?: string;
    readonly path: readonly string[];
    readonly segment: string;
};

export type LayeredLoggerOptions = {
    readonly filters?: {
        readonly caseSensitive?: boolean;
        readonly maxArgsTextLength?: number;
    };
    readonly globalControl?: {
        readonly enabled?: boolean;
        readonly key?: string;
        readonly target?: object;
    };
    readonly mode?: LayeredLoggerBaselineMode;
    readonly persistence?: {
        readonly enabled?: boolean;
        readonly storage?: LayeredLoggerStorage;
        readonly storageKey?: string;
    };
    readonly scope?: {
        readonly colorResolver?: (context: LayeredLoggerScopeContext) => string | undefined;
        readonly normalize?: (segment: string) => string;
    };
};

export type LayeredLoggerToolkit = {
    readonly control: LayeredLoggerControl;
    createLogger(): LayeredLogger;
};

export type LayeredLoggerLayerTreeNode = {
    readonly alias?: string | readonly string[];
    readonly children?: Record<string, LayeredLoggerLayerTreeNode>;
    readonly color?: string;
};

export type LayeredLoggerLayerTree = Record<string, LayeredLoggerLayerTreeNode>;

type LayerScope = {
    readonly color?: string;
    readonly id: string;
};

type LayeredLoggerStateSnapshot = {
    readonly baselineMode: LayeredLoggerBaselineMode;
    readonly nextRuleId: number;
    readonly rules: readonly LayeredLoggerRule[];
};

type LayeredLoggerState = {
    baselineMode: LayeredLoggerBaselineMode;
    history: LayeredLoggerStateSnapshot[];
    nextRuleId: number;
    rules: LayeredLoggerRule[];
};

type LayeredLoggerMatchContext = {
    readonly argsText: string;
    readonly level: LoggerMethodName;
    readonly message: string;
    readonly scopeSegments: readonly string[];
};

type LayeredLoggerPersistedState = {
    readonly baselineMode: LayeredLoggerBaselineMode;
    readonly nextRuleId: number;
    readonly rules: readonly LayeredLoggerRule[];
};

const LOGGER_METHOD_NAMES: readonly LoggerMethodName[] = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
];
const LOGGER_SCOPE_STYLE_RESET = 'font-weight: inherit; color: inherit;';
const LOGGER_STAR_SELECTOR = '*';
const LOGGER_DEFAULT_STORAGE_KEY = '__layeredInfraDevLoggerState__';
const LOGGER_DEFAULT_GLOBAL_KEY = 'logger';
const LOGGER_DEFAULT_MAX_ARGS_TEXT = 8_192;

function defaultScopeNormalizer(segment: string): string {
    return segment.replace(/\s+/g, '').toUpperCase();
}

function buildScopeStyle(scope: LayerScope): string {
    const colorPart = scope.color === undefined ? '' : `color: ${scope.color}; `;
    return `${colorPart}font-weight: 700;`;
}

function buildPrefixConsoleArgs(scopes: readonly LayerScope[]): readonly unknown[] {
    if (scopes.length === 0) {
        return [];
    }

    const formatSegments = scopes.map((scope) => `%c[ ${scope.id} ]%c`);
    const styles = scopes.flatMap((scope) => [buildScopeStyle(scope), LOGGER_SCOPE_STYLE_RESET]);
    return [`${formatSegments.join(' ')} `, ...styles];
}

function cloneSelector(selector: LayeredLoggerSelector): LayeredLoggerSelector {
    return {
        args: {
            mode: selector.args.mode,
            pattern: selector.args.pattern,
        },
        levels:
            selector.levels === LOGGER_STAR_SELECTOR ? LOGGER_STAR_SELECTOR : [...selector.levels],
        message: {
            mode: selector.message.mode,
            pattern: selector.message.pattern,
        },
        scopeMatchMode: selector.scopeMatchMode,
        scopeSegments: [...selector.scopeSegments],
        source: selector.source,
    };
}

function cloneRule(rule: LayeredLoggerRule): LayeredLoggerRule {
    return {
        createdAtMs: rule.createdAtMs,
        hits: rule.hits,
        id: rule.id,
        kind: rule.kind,
        lastMatchedAtMs: rule.lastMatchedAtMs,
        selector: cloneSelector(rule.selector),
    };
}

function cloneStateSnapshot(state: LayeredLoggerState): LayeredLoggerStateSnapshot {
    return {
        baselineMode: state.baselineMode,
        nextRuleId: state.nextRuleId,
        rules: state.rules.map((rule) => cloneRule(rule)),
    };
}

function applyStateSnapshot(state: LayeredLoggerState, snapshot: LayeredLoggerStateSnapshot): void {
    state.baselineMode = snapshot.baselineMode;
    state.nextRuleId = snapshot.nextRuleId;
    state.rules = snapshot.rules.map((rule) => cloneRule(rule));
}

function toIsoTimestamp(timestampMs: number | undefined): string | undefined {
    if (timestampMs === undefined) {
        return undefined;
    }

    return new window.Date(timestampMs).toISOString();
}

function selectorToString(selector: LayeredLoggerSelector): string {
    const scopePrefix = selector.scopeSegments.map((segment) => `[ ${segment} ]`).join(' ');
    const scopePart =
        selector.scopeMatchMode === 'prefix'
            ? `${scopePrefix}${scopePrefix === '' ? '' : ' '}[ * ]`
            : scopePrefix;
    const levelsPart =
        selector.levels === LOGGER_STAR_SELECTOR ? LOGGER_STAR_SELECTOR : selector.levels.join(',');
    const messagePart =
        selector.message.mode === 'exact'
            ? `eq:${selector.message.pattern}`
            : selector.message.pattern;
    const argsPart =
        selector.args.mode === 'exact' ? `eq:${selector.args.pattern}` : selector.args.pattern;
    return `${scopePart} | ${levelsPart} | ${messagePart} | ${argsPart}`;
}

function toRuleView(rule: LayeredLoggerRule): LayeredLoggerRuleView {
    return {
        createdAtIso: new window.Date(rule.createdAtMs).toISOString(),
        hits: rule.hits,
        id: rule.id,
        kind: rule.kind,
        lastMatchedAtIso: toIsoTimestamp(rule.lastMatchedAtMs),
        selector: selectorToString(rule.selector),
    };
}

function parseSelectorSource(input: string): string | undefined {
    const raw = input.trim();
    if (raw === '') {
        return undefined;
    }

    const ruleIndex = raw.toLowerCase().indexOf('rule:');
    if (ruleIndex >= 0) {
        const fromRule = raw.slice(ruleIndex + 'rule:'.length).trim();
        return fromRule === '' ? undefined : fromRule;
    }

    return raw;
}

function parseLevels(rawLevels: string | undefined): readonly LoggerMethodName[] | '*' | undefined {
    if (
        rawLevels === undefined ||
        rawLevels.trim() === '' ||
        rawLevels.trim() === LOGGER_STAR_SELECTOR
    ) {
        return LOGGER_STAR_SELECTOR;
    }

    const chunks = rawLevels
        .split(',')
        .map((chunk) => chunk.trim().toLowerCase())
        .filter((chunk) => chunk !== '');

    if (chunks.length === 0) {
        return LOGGER_STAR_SELECTOR;
    }

    const levelSet = new window.Set<LoggerMethodName>();
    for (const chunk of chunks) {
        if (
            chunk !== 'trace' &&
            chunk !== 'debug' &&
            chunk !== 'info' &&
            chunk !== 'warn' &&
            chunk !== 'error'
        ) {
            return undefined;
        }

        levelSet.add(chunk);
    }

    return [...levelSet];
}

function parseTextMatcher(rawPattern: string | undefined): LayeredLoggerTextMatcher {
    const normalizedPattern =
        rawPattern === undefined || rawPattern.trim() === ''
            ? LOGGER_STAR_SELECTOR
            : rawPattern.trim();
    if (normalizedPattern.toLowerCase().startsWith('eq:')) {
        return {
            mode: 'exact',
            pattern: normalizedPattern.slice('eq:'.length),
        };
    }

    return {
        mode: 'glob',
        pattern: normalizedPattern,
    };
}

function parseSelector(
    input: string,
    normalizeScopeSegment: (segment: string) => string
): LayeredLoggerSelector | undefined {
    const source = parseSelectorSource(input);
    if (source === undefined) {
        return undefined;
    }

    const sections = source.split('|').map((section) => section.trim());
    const scopePart = sections[0];
    if (scopePart === undefined || scopePart === '') {
        return undefined;
    }

    const scopeRegex = /\[\s*([^\]]+?)\s*\]/g;
    const rawSegments: string[] = [];
    let scopeMatch = scopeRegex.exec(scopePart);
    while (scopeMatch !== null) {
        const segment = normalizeScopeSegment(scopeMatch[1] ?? '');
        if (segment !== '') {
            rawSegments.push(segment);
        }

        scopeMatch = scopeRegex.exec(scopePart);
    }

    if (rawSegments.length === 0) {
        return undefined;
    }

    let scopeMatchMode: LayeredLoggerScopeMatchMode = 'exact';
    if (rawSegments.at(-1) === LOGGER_STAR_SELECTOR) {
        scopeMatchMode = 'prefix';
        rawSegments.pop();
    }

    if (rawSegments.includes(LOGGER_STAR_SELECTOR)) {
        return undefined;
    }

    const levels = parseLevels(sections[1]);
    if (levels === undefined) {
        return undefined;
    }

    return {
        args: parseTextMatcher(sections[3]),
        levels,
        message: parseTextMatcher(sections[2]),
        scopeMatchMode,
        scopeSegments: rawSegments,
        source,
    };
}

function escapeRegexChars(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesGlob(pattern: string, value: string): boolean {
    if (pattern === LOGGER_STAR_SELECTOR) {
        return true;
    }

    const regexSource = `^${pattern
        .split(LOGGER_STAR_SELECTOR)
        .map((part) => escapeRegexChars(part))
        .join('.*')}$`;
    const matcher = new window.RegExp(regexSource, 'i');
    return matcher.test(value);
}

function normalizeForComparison(value: string, caseSensitive: boolean): string {
    return caseSensitive ? value : value.toLowerCase();
}

function matchesTextMatcher(
    matcher: LayeredLoggerTextMatcher,
    value: string,
    caseSensitive: boolean
): boolean {
    const normalizedValue = normalizeForComparison(value, caseSensitive);
    const normalizedPattern = normalizeForComparison(matcher.pattern, caseSensitive);
    if (matcher.mode === 'exact') {
        return normalizedPattern === normalizedValue;
    }

    return matchesGlob(normalizedPattern, normalizedValue);
}

function matchesScope(
    selector: LayeredLoggerSelector,
    scopeSegments: readonly string[],
    normalizeScopeSegment: (segment: string) => string
): boolean {
    if (
        selector.scopeMatchMode === 'exact' &&
        selector.scopeSegments.length !== scopeSegments.length
    ) {
        return false;
    }

    return selector.scopeSegments.every(
        (segment, index) => segment === normalizeScopeSegment(scopeSegments[index] ?? '')
    );
}

function matchesLevels(
    levels: readonly LoggerMethodName[] | '*',
    level: LoggerMethodName
): boolean {
    if (levels === LOGGER_STAR_SELECTOR) {
        return true;
    }

    return levels.includes(level);
}

function matchesSelector(
    selector: LayeredLoggerSelector,
    context: LayeredLoggerMatchContext,
    options: {
        readonly caseSensitive: boolean;
        readonly normalizeScopeSegment: (segment: string) => string;
    }
): boolean {
    if (!matchesScope(selector, context.scopeSegments, options.normalizeScopeSegment)) {
        return false;
    }

    if (!matchesLevels(selector.levels, context.level)) {
        return false;
    }

    if (!matchesTextMatcher(selector.message, context.message, options.caseSensitive)) {
        return false;
    }

    return matchesTextMatcher(selector.args, context.argsText, options.caseSensitive);
}

function extractMessageForFiltering(args: readonly unknown[]): string {
    if (args.length === 0) {
        return '';
    }

    const firstArg = args[0];
    if (typeof firstArg === 'string') {
        return firstArg;
    }

    if (firstArg instanceof window.Error) {
        return firstArg.message;
    }

    return window.String(firstArg);
}

function toSerializableError(error: Error): {
    readonly message: string;
    readonly name: string;
    readonly stack?: string;
} {
    return {
        message: error.message,
        name: error.name,
        stack: error.stack,
    };
}

function safeSerializeArg(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        return window.String(value);
    }

    if (typeof value === 'undefined') {
        return 'undefined';
    }

    if (typeof value === 'bigint') {
        return `bigint:${value.toString()}`;
    }

    if (typeof value === 'symbol') {
        return value.toString();
    }

    if (typeof value === 'function') {
        const functionName = value.name === '' ? 'anonymous' : value.name;
        return `[Function:${functionName}]`;
    }

    if (value instanceof window.Error) {
        return window.JSON.stringify(toSerializableError(value));
    }

    if (typeof value === 'object') {
        const seenObjects = new window.WeakSet<object>();
        try {
            const serialized = window.JSON.stringify(value, (_key, nestedValue: unknown) => {
                if (nestedValue instanceof window.Error) {
                    return toSerializableError(nestedValue);
                }

                if (typeof nestedValue === 'bigint') {
                    return `bigint:${nestedValue.toString()}`;
                }

                if (typeof nestedValue === 'function') {
                    const nestedName = nestedValue.name === '' ? 'anonymous' : nestedValue.name;
                    return `[Function:${nestedName}]`;
                }

                if (typeof nestedValue === 'symbol') {
                    return nestedValue.toString();
                }

                if (typeof nestedValue === 'object' && nestedValue !== null) {
                    if (seenObjects.has(nestedValue)) {
                        return '[Circular]';
                    }

                    seenObjects.add(nestedValue);
                }

                return nestedValue;
            });
            return serialized ?? window.String(value);
        } catch {
            return window.String(value);
        }
    }

    return window.String(value);
}

function extractArgsForFiltering(args: readonly unknown[], maxTextLength: number): string {
    if (args.length <= 1) {
        return '';
    }

    const serializedArgs = args
        .slice(1)
        .map((arg) => safeSerializeArg(arg))
        .join(' ');
    if (serializedArgs.length <= maxTextLength) {
        return serializedArgs;
    }

    return `${serializedArgs.slice(0, maxTextLength)}...truncated`;
}

function createRulePreview(rules: readonly LayeredLoggerRule[]): LayeredLoggerRemovePreview {
    return {
        matchedCount: rules.length,
        matchedIds: rules.map((rule) => rule.id),
        rules: rules.map((rule) => toRuleView(rule)),
    };
}

function hasLevelOverlap(
    left: readonly LoggerMethodName[] | '*',
    right: readonly LoggerMethodName[] | '*'
): boolean {
    if (left === LOGGER_STAR_SELECTOR || right === LOGGER_STAR_SELECTOR) {
        return true;
    }

    return left.some((level) => right.includes(level));
}

function hasTextMatcherOverlap(
    left: LayeredLoggerTextMatcher,
    right: LayeredLoggerTextMatcher,
    caseSensitive: boolean
): boolean {
    if (left.mode === 'glob' && left.pattern === LOGGER_STAR_SELECTOR) {
        return true;
    }

    if (right.mode === 'glob' && right.pattern === LOGGER_STAR_SELECTOR) {
        return true;
    }

    if (left.mode === 'exact' && right.mode === 'exact') {
        return (
            normalizeForComparison(left.pattern, caseSensitive) ===
            normalizeForComparison(right.pattern, caseSensitive)
        );
    }

    if (left.mode === 'exact' && right.mode === 'glob') {
        return matchesGlob(
            normalizeForComparison(right.pattern, caseSensitive),
            normalizeForComparison(left.pattern, caseSensitive)
        );
    }

    if (left.mode === 'glob' && right.mode === 'exact') {
        return matchesGlob(
            normalizeForComparison(left.pattern, caseSensitive),
            normalizeForComparison(right.pattern, caseSensitive)
        );
    }

    return (
        matchesGlob(
            normalizeForComparison(left.pattern, caseSensitive),
            normalizeForComparison(right.pattern, caseSensitive)
        ) ||
        matchesGlob(
            normalizeForComparison(right.pattern, caseSensitive),
            normalizeForComparison(left.pattern, caseSensitive)
        )
    );
}

function selectorMatchesRule(
    selector: LayeredLoggerSelector,
    rule: LayeredLoggerRule,
    options: {
        readonly caseSensitive: boolean;
        readonly normalizeScopeSegment: (segment: string) => string;
    }
): boolean {
    if (!matchesScope(selector, rule.selector.scopeSegments, options.normalizeScopeSegment)) {
        return false;
    }

    if (!hasLevelOverlap(selector.levels, rule.selector.levels)) {
        return false;
    }

    if (!hasTextMatcherOverlap(selector.message, rule.selector.message, options.caseSensitive)) {
        return false;
    }

    return hasTextMatcherOverlap(selector.args, rule.selector.args, options.caseSensitive);
}

function isNumberArray(value: LayeredLoggerRemoveTarget): value is readonly number[] {
    if (!window.Array.isArray(value)) {
        return false;
    }

    return value.every((item) => typeof item === 'number');
}

function parseIdList(value: string): readonly number[] {
    const chunks = value
        .split(',')
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk !== '');
    if (chunks.length === 0) {
        return [];
    }

    const parsed: number[] = [];
    for (const chunk of chunks) {
        const parsedNumber = window.Number(chunk);
        if (!window.Number.isInteger(parsedNumber)) {
            return [];
        }

        parsed.push(parsedNumber);
    }

    return parsed;
}

function resolveRulesByTarget(
    state: LayeredLoggerState,
    target: LayeredLoggerRemoveTarget,
    options: {
        readonly caseSensitive: boolean;
        readonly normalizeScopeSegment: (segment: string) => string;
    }
): readonly LayeredLoggerRule[] {
    if (typeof target === 'number') {
        return state.rules.filter((rule) => rule.id === target);
    }

    if (isNumberArray(target)) {
        const idSet = new window.Set(target);
        return state.rules.filter((rule) => idSet.has(rule.id));
    }

    const idList = parseIdList(target);
    if (idList.length > 0) {
        const idSet = new window.Set(idList);
        return state.rules.filter((rule) => idSet.has(rule.id));
    }

    const selector = parseSelector(target, options.normalizeScopeSegment);
    if (selector === undefined) {
        return [];
    }

    return state.rules.filter((rule) => selectorMatchesRule(selector, rule, options));
}

function createMatchPreview(
    state: LayeredLoggerState,
    kind: LayeredLoggerRuleKind,
    input: string,
    options: {
        readonly caseSensitive: boolean;
        readonly normalizeScopeSegment: (segment: string) => string;
    }
): LayeredLoggerMatchPreview {
    if (input.trim() === LOGGER_STAR_SELECTOR) {
        return {
            overriddenRuleIds: state.rules.map((rule) => rule.id),
            wouldAffect: state.rules.length > 0,
        };
    }

    const selector = parseSelector(input, options.normalizeScopeSegment);
    if (selector === undefined) {
        return {
            overriddenRuleIds: [],
            wouldAffect: false,
        };
    }

    const oppositeKind: LayeredLoggerRuleKind = kind === 'enabled' ? 'disabled' : 'enabled';
    const overriddenRuleIds = state.rules
        .filter((rule) => rule.kind === oppositeKind)
        .filter((rule) => selectorMatchesRule(selector, rule, options))
        .map((rule) => rule.id);

    return {
        overriddenRuleIds,
        wouldAffect: overriddenRuleIds.length > 0,
    };
}

function resolveStorage(options: LayeredLoggerOptions): LayeredLoggerStorage | undefined {
    const persistenceEnabled = options.persistence?.enabled ?? true;
    if (!persistenceEnabled) {
        return undefined;
    }

    if (options.persistence?.storage !== undefined) {
        return options.persistence.storage;
    }

    if (typeof globalThis !== 'object' || globalThis === null) {
        return undefined;
    }

    const storageCandidate = Reflect.get(globalThis, 'localStorage');
    if (typeof storageCandidate !== 'object' || storageCandidate === null) {
        return undefined;
    }

    if (!('getItem' in storageCandidate) || typeof storageCandidate.getItem !== 'function') {
        return undefined;
    }

    if (!('setItem' in storageCandidate) || typeof storageCandidate.setItem !== 'function') {
        return undefined;
    }

    if (!('removeItem' in storageCandidate) || typeof storageCandidate.removeItem !== 'function') {
        return undefined;
    }

    return storageCandidate;
}

function isValidPersistedRuleKind(value: unknown): value is LayeredLoggerRuleKind {
    return value === 'enabled' || value === 'disabled';
}

function isValidPersistedBaselineMode(value: unknown): value is LayeredLoggerBaselineMode {
    return value === 'all-enabled' || value === 'all-disabled';
}

function isValidPersistedMessageMode(value: unknown): value is LayeredLoggerTextMatchMode {
    return value === 'glob' || value === 'exact';
}

function isPersistedStateCandidate(value: unknown): value is LayeredLoggerPersistedState {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    if (!('baselineMode' in value) || !isValidPersistedBaselineMode(value.baselineMode)) {
        return false;
    }

    if (
        !('nextRuleId' in value) ||
        typeof value.nextRuleId !== 'number' ||
        !window.Number.isInteger(value.nextRuleId) ||
        value.nextRuleId < 1
    ) {
        return false;
    }

    if (!('rules' in value) || !window.Array.isArray(value.rules)) {
        return false;
    }

    for (const rule of value.rules) {
        if (typeof rule !== 'object' || rule === null) {
            return false;
        }

        if (
            !('id' in rule) ||
            typeof rule.id !== 'number' ||
            !window.Number.isInteger(rule.id) ||
            rule.id < 1
        ) {
            return false;
        }

        if (
            !('createdAtMs' in rule) ||
            typeof rule.createdAtMs !== 'number' ||
            !window.Number.isFinite(rule.createdAtMs)
        ) {
            return false;
        }

        if (
            !('hits' in rule) ||
            typeof rule.hits !== 'number' ||
            !window.Number.isInteger(rule.hits) ||
            rule.hits < 0
        ) {
            return false;
        }

        if (!('kind' in rule) || !isValidPersistedRuleKind(rule.kind)) {
            return false;
        }

        if (!('selector' in rule) || typeof rule.selector !== 'object' || rule.selector === null) {
            return false;
        }

        const selector = rule.selector;
        if (
            !('scopeMatchMode' in selector) ||
            (selector.scopeMatchMode !== 'exact' && selector.scopeMatchMode !== 'prefix')
        ) {
            return false;
        }

        if (
            !('scopeSegments' in selector) ||
            !window.Array.isArray(selector.scopeSegments) ||
            selector.scopeSegments.some((segment: unknown) => typeof segment !== 'string')
        ) {
            return false;
        }

        if (
            !('message' in selector) ||
            typeof selector.message !== 'object' ||
            selector.message === null
        ) {
            return false;
        }

        const message = selector.message;
        if (
            !('mode' in message) ||
            !isValidPersistedMessageMode(message.mode) ||
            !('pattern' in message) ||
            typeof message.pattern !== 'string'
        ) {
            return false;
        }

        if (!('args' in selector) || typeof selector.args !== 'object' || selector.args === null) {
            return false;
        }

        const args = selector.args;
        if (
            !('mode' in args) ||
            !isValidPersistedMessageMode(args.mode) ||
            !('pattern' in args) ||
            typeof args.pattern !== 'string'
        ) {
            return false;
        }

        if (!('source' in selector) || typeof selector.source !== 'string') {
            return false;
        }

        if (!('levels' in selector)) {
            return false;
        }

        if (selector.levels !== LOGGER_STAR_SELECTOR) {
            if (!window.Array.isArray(selector.levels)) {
                return false;
            }

            const isValidLevel = selector.levels.every(
                (level: unknown) =>
                    level === 'trace' ||
                    level === 'debug' ||
                    level === 'info' ||
                    level === 'warn' ||
                    level === 'error'
            );
            if (!isValidLevel) {
                return false;
            }
        }
    }

    return true;
}

function hydrateState(
    storage: LayeredLoggerStorage | undefined,
    storageKey: string
): LayeredLoggerPersistedState | undefined {
    if (storage === undefined) {
        return undefined;
    }

    try {
        const raw = storage.getItem(storageKey);
        if (raw === null || raw.trim() === '') {
            return undefined;
        }

        const parsed: unknown = window.JSON.parse(raw);
        if (!isPersistedStateCandidate(parsed)) {
            storage.removeItem(storageKey);
            return undefined;
        }

        return parsed;
    } catch {
        try {
            storage.removeItem(storageKey);
        } catch {
            return undefined;
        }

        return undefined;
    }
}

function persistState(
    storage: LayeredLoggerStorage | undefined,
    storageKey: string,
    state: LayeredLoggerState
): void {
    if (storage === undefined) {
        return;
    }

    try {
        storage.setItem(
            storageKey,
            window.JSON.stringify({
                baselineMode: state.baselineMode,
                nextRuleId: state.nextRuleId,
                rules: state.rules.map((rule) => cloneRule(rule)),
            })
        );
    } catch {
        return;
    }
}

function attachGlobalControl(options: LayeredLoggerOptions, control: LayeredLoggerControl): void {
    const globalEnabled = options.globalControl?.enabled ?? true;
    if (!globalEnabled) {
        return;
    }

    const key = options.globalControl?.key ?? LOGGER_DEFAULT_GLOBAL_KEY;
    const target = options.globalControl?.target ?? globalThis;
    window.Object.defineProperty(target, key, {
        configurable: true,
        enumerable: false,
        value: control,
        writable: true,
    });
}

function registerLoggerAlias(
    namedLoggers: Record<string, LayeredLogger>,
    aliasOrAliases: string | readonly string[],
    logger: LayeredLogger
): void {
    const aliases = typeof aliasOrAliases === 'string' ? [aliasOrAliases] : [...aliasOrAliases];
    for (const alias of aliases) {
        const normalizedAlias = alias.trim();
        if (normalizedAlias === '') {
            continue;
        }

        if (normalizedAlias in namedLoggers) {
            throw new window.Error(`Duplicate logger alias: ${normalizedAlias}`);
        }

        namedLoggers[normalizedAlias] = logger;
    }
}

function collectLayeredLoggers(
    parentLogger: LayeredLogger,
    layers: LayeredLoggerLayerTree,
    namedLoggers: Record<string, LayeredLogger>
): void {
    for (const [rawSegment, node] of window.Object.entries(layers)) {
        const segment = defaultScopeNormalizer(rawSegment);
        if (segment === '') {
            continue;
        }

        const childLogger = parentLogger.child(segment, { color: node.color });
        if (node.alias !== undefined) {
            registerLoggerAlias(namedLoggers, node.alias, childLogger);
        }

        if (node.children !== undefined) {
            collectLayeredLoggers(childLogger, node.children, namedLoggers);
        }
    }
}

export function createLayeredLoggers(
    baseLogger: LayeredLogger,
    layers: LayeredLoggerLayerTree
): Record<string, LayeredLogger> {
    const namedLoggers: Record<string, LayeredLogger> = {};
    collectLayeredLoggers(baseLogger, layers, namedLoggers);
    return namedLoggers;
}

export function createLayeredLoggerToolkit(
    options: LayeredLoggerOptions = {}
): LayeredLoggerToolkit {
    const normalizeScopeSegment = options.scope?.normalize ?? defaultScopeNormalizer;
    const caseSensitive = options.filters?.caseSensitive ?? false;
    const maxArgsTextLength = options.filters?.maxArgsTextLength ?? LOGGER_DEFAULT_MAX_ARGS_TEXT;
    const storageKey = options.persistence?.storageKey ?? LOGGER_DEFAULT_STORAGE_KEY;
    const storage = resolveStorage(options);
    const persistedState = hydrateState(storage, storageKey);

    const state: LayeredLoggerState = {
        baselineMode: persistedState?.baselineMode ?? options.mode ?? 'all-enabled',
        history: [],
        nextRuleId: persistedState?.nextRuleId ?? 1,
        rules: persistedState?.rules.map((rule) => cloneRule(rule)) ?? [],
    };

    const selectorOptions = {
        caseSensitive,
        normalizeScopeSegment,
    };

    function writeState(): void {
        persistState(storage, storageKey, state);
    }

    function pushHistorySnapshot(): void {
        state.history.push(cloneStateSnapshot(state));
    }

    function switchBaselineMode(
        mode: LayeredLoggerBaselineMode
    ): LayeredLoggerRuleView | undefined {
        if (state.baselineMode === mode && state.rules.length === 0) {
            return undefined;
        }

        pushHistorySnapshot();
        state.baselineMode = mode;
        state.rules = [];
        writeState();
        return undefined;
    }

    function appendRule(
        kind: LayeredLoggerRuleKind,
        input: string
    ): LayeredLoggerRuleView | undefined {
        const trimmedInput = input.trim();
        if (trimmedInput === LOGGER_STAR_SELECTOR) {
            return kind === 'enabled'
                ? switchBaselineMode('all-enabled')
                : switchBaselineMode('all-disabled');
        }

        const selector = parseSelector(input, normalizeScopeSegment);
        if (selector === undefined) {
            return undefined;
        }

        pushHistorySnapshot();
        const rule: LayeredLoggerRule = {
            createdAtMs: window.Date.now(),
            hits: 0,
            id: state.nextRuleId,
            kind,
            selector,
        };
        state.nextRuleId += 1;
        state.rules.push(rule);
        writeState();
        return toRuleView(rule);
    }

    function previewRemove(target: LayeredLoggerRemoveTarget): LayeredLoggerRemovePreview {
        return createRulePreview(resolveRulesByTarget(state, target, selectorOptions));
    }

    function remove(target: LayeredLoggerRemoveTarget): LayeredLoggerRemovePreview {
        const rulesToRemove = resolveRulesByTarget(state, target, selectorOptions);
        if (rulesToRemove.length === 0) {
            return createRulePreview([]);
        }

        const idSet = new window.Set(rulesToRemove.map((rule) => rule.id));
        pushHistorySnapshot();
        state.rules = state.rules.filter((rule) => !idSet.has(rule.id));
        writeState();
        return createRulePreview(rulesToRemove);
    }

    function clear(kind: LayeredLoggerRuleListKind = 'all'): LayeredLoggerRemovePreview {
        const rulesToRemove =
            kind === 'all' ? state.rules : state.rules.filter((rule) => rule.kind === kind);
        if (rulesToRemove.length === 0) {
            return createRulePreview([]);
        }

        const idSet = new window.Set(rulesToRemove.map((rule) => rule.id));
        pushHistorySnapshot();
        state.rules = state.rules.filter((rule) => !idSet.has(rule.id));
        writeState();
        return createRulePreview(rulesToRemove);
    }

    function focus(input: string): LayeredLoggerRuleView | undefined {
        const selector = parseSelector(input, normalizeScopeSegment);
        if (selector === undefined) {
            return undefined;
        }

        pushHistorySnapshot();
        state.baselineMode = 'all-disabled';
        state.rules = [];

        const rule: LayeredLoggerRule = {
            createdAtMs: window.Date.now(),
            hits: 0,
            id: state.nextRuleId,
            kind: 'enabled',
            selector,
        };
        state.nextRuleId += 1;
        state.rules.push(rule);
        writeState();
        return toRuleView(rule);
    }

    function reset(): LayeredLoggerRemovePreview {
        const removed = createRulePreview(state.rules);
        if (state.baselineMode === 'all-enabled' && state.rules.length === 0) {
            return removed;
        }

        pushHistorySnapshot();
        state.baselineMode = 'all-enabled';
        state.rules = [];
        writeState();
        return removed;
    }

    function undo(): boolean {
        const snapshot = state.history.pop();
        if (snapshot === undefined) {
            return false;
        }

        applyStateSnapshot(state, snapshot);
        writeState();
        return true;
    }

    function show(kind: LayeredLoggerRuleListKind = 'all'): readonly LayeredLoggerRuleView[] {
        const rules =
            kind === 'all' ? state.rules : state.rules.filter((rule) => rule.kind === kind);
        return rules.map((rule) => toRuleView(rule));
    }

    function showMode(): LayeredLoggerBaselineMode {
        return state.baselineMode;
    }

    const control: LayeredLoggerControl = {
        clear,
        disable: (input) => appendRule('disabled', input),
        enable: (input) => appendRule('enabled', input),
        focus,
        previewDisable: (input) => createMatchPreview(state, 'disabled', input, selectorOptions),
        previewEnable: (input) => createMatchPreview(state, 'enabled', input, selectorOptions),
        previewRemove,
        remove,
        reset,
        shoMode: showMode,
        show,
        showMode,
        undo,
    };

    attachGlobalControl(options, control);

    function resolveLogDecision(
        scopes: readonly LayerScope[],
        level: LoggerMethodName,
        args: readonly unknown[]
    ): boolean {
        const context: LayeredLoggerMatchContext = {
            argsText: extractArgsForFiltering(args, maxArgsTextLength),
            level,
            message: extractMessageForFiltering(args),
            scopeSegments: scopes.map((scope) => scope.id),
        };

        for (let index = state.rules.length - 1; index >= 0; index -= 1) {
            const rule = state.rules[index];
            if (rule === undefined) {
                continue;
            }

            if (!matchesSelector(rule.selector, context, selectorOptions)) {
                continue;
            }

            const updatedRule: LayeredLoggerRule = {
                ...rule,
                hits: rule.hits + 1,
                lastMatchedAtMs: window.Date.now(),
            };
            state.rules[index] = updatedRule;
            writeState();
            return rule.kind === 'enabled';
        }

        return state.baselineMode === 'all-enabled';
    }

    function resolveScopeColor(
        parentScopes: readonly LayerScope[],
        segment: string,
        overrideColor?: string
    ): string | undefined {
        if (overrideColor !== undefined) {
            return overrideColor;
        }

        const parentColor = parentScopes.at(-1)?.color;
        if (options.scope?.colorResolver === undefined) {
            return parentColor;
        }

        return (
            options.scope.colorResolver({
                index: parentScopes.length,
                parentColor,
                path: [...parentScopes.map((scope) => scope.id), segment],
                segment,
            }) ?? parentColor
        );
    }

    function emitToConsole(
        level: LoggerMethodName,
        scopes: readonly LayerScope[],
        args: readonly unknown[]
    ): void {
        const consoleMethod = window.console[level];
        const boundMethod = consoleMethod.bind(window.console);
        const prefixArgs = buildPrefixConsoleArgs(scopes);
        boundMethod(...prefixArgs, ...args);
    }

    function createLoggerWithScopes(scopes: readonly LayerScope[]): LayeredLogger {
        const logger = LOGGER_METHOD_NAMES.reduce<LayeredLogger>(
            (currentLogger, methodName) => {
                currentLogger[methodName] = (...args: readonly unknown[]) => {
                    if (!resolveLogDecision(scopes, methodName, args)) {
                        return;
                    }

                    emitToConsole(methodName, scopes, args);
                };

                return currentLogger;
            },
            {
                child: () => createLoggerWithScopes(scopes),
                debug: () => undefined,
                error: () => undefined,
                info: () => undefined,
                scope: () => createLoggerWithScopes(scopes),
                trace: () => undefined,
                warn: () => undefined,
            }
        );

        const createChildLogger = (
            segment: string,
            scopeOptions: LayeredLoggerScopeOptions = {}
        ) => {
            const normalizedSegment = normalizeScopeSegment(segment);
            if (normalizedSegment === '') {
                return createLoggerWithScopes(scopes);
            }

            const color = resolveScopeColor(scopes, normalizedSegment, scopeOptions.color);
            return createLoggerWithScopes([
                ...scopes,
                {
                    color,
                    id: normalizedSegment,
                },
            ]);
        };
        logger.child = createChildLogger;
        logger.scope = createChildLogger;

        return logger;
    }

    return {
        control,
        createLogger: () => createLoggerWithScopes([]),
    };
}
