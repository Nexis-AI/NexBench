/**
 * The submission check engine. One list of checks, one validator — used by the
 * CLI (`nexbench validate`), the submit portal (browser preview), and the
 * intake API (enforcement). Adding a rule here updates every surface.
 *
 * The manifest is parsed by a hand-written structural validator (no runtime
 * dependencies) that mirrors the published `nexbench.run/2.1` shape, then the
 * twelve integrity checks run over the parsed value.
 */
import type { CategoryId, RunManifest } from './types.js';
export type CheckStatus = 'pass' | 'fail' | 'flag';
export type CheckSeverity = 'error' | 'warn';
export type CheckResult = {
    id: string;
    title: string;
    severity: CheckSeverity;
    status: CheckStatus;
    detail: string;
};
/** Minimal projection of already-listed runs used for duplicate detection. */
export type KnownRun = {
    runId: string;
    traceRoot: string;
    agentId: string;
    submitter: string;
    scores: Record<CategoryId, number>;
};
export type ValidationReport = {
    /** No error-severity failures — eligible for intake. */
    ok: boolean;
    /** Passed, but with warn-severity flags — listed only after manual review. */
    flagged: boolean;
    runId: string | null;
    digest: string;
    checks: CheckResult[];
};
/** Check catalog — rendered on the submit page as the enforced policy. */
export declare const CHECK_DEFS: readonly {
    id: string;
    title: string;
    severity: CheckSeverity;
    description: string;
}[];
export type ParseIssue = {
    path: string;
    message: string;
};
type ParseResult = {
    ok: true;
    data: RunManifest;
} | {
    ok: false;
    issues: ParseIssue[];
};
/**
 * Structural validator for `nexbench.run/2.1`. Returns typed data or a list of
 * path/message issues in the same style the site's zod schema produces, so the
 * `schema` check reads identically across surfaces.
 */
export declare function parseManifest(input: unknown): ParseResult;
/**
 * Run the full check stack against an untrusted manifest. Pure function of
 * (input, known runs) — identical verdicts in the browser preview, on the
 * intake API, and in `nexbench validate`.
 */
export declare function validateManifest(input: unknown, known: readonly KnownRun[]): Promise<ValidationReport>;
export {};
