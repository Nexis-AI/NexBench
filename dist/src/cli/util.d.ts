/** Small zero-dependency helpers shared by the CLI commands. */
export type Args = {
    _: string[];
    flags: Record<string, string | boolean>;
};
/** Parse `--key value`, `--key=value`, `--bool`, and positionals. */
export declare function parseArgs(argv: string[]): Args;
/** Walk up from this module until a directory containing package.json. */
export declare function pkgRoot(): string;
export declare function dataPath(...parts: string[]): string;
export declare function loadJson<T = unknown>(path: string): T;
export declare const c: {
    bold: (s: string) => string;
    dim: (s: string) => string;
    green: (s: string) => string;
    red: (s: string) => string;
    yellow: (s: string) => string;
    cyan: (s: string) => string;
    gray: (s: string) => string;
};
export declare function bar(pct: number, width?: number): string;
export declare function statusMark(status: 'pass' | 'fail' | 'flag'): string;
export declare function pad(s: string, n: number): string;
export declare function padStart(s: string, n: number): string;
export declare function fail(msg: string): never;
