/**
 * The submission check engine. One list of checks, one validator — used by the
 * CLI (`nexbench validate`), the submit portal (browser preview), and the
 * intake API (enforcement). Adding a rule here updates every surface.
 *
 * The manifest is parsed by a hand-written structural validator (no runtime
 * dependencies) that mirrors the published `nexbench.run/2.1` shape, then the
 * twelve integrity checks run over the parsed value.
 */

import {
  computeRunId,
  isOnTaskGrid,
  isOnTrialGrid,
  manifestDigest,
  maxCategoryDelta,
} from './integrity.js';
import { overallScore } from './scoring.js';
import {
  BENCH_NAME,
  BENCH_SCHEMA,
  BENCH_VERSION,
  categories,
  ENV_PINS_DIGEST,
  KNOWN_HARNESS_BUILDS,
  TASK_COST_CAP_USD,
  TASK_TIMEOUT_S,
  TOTAL_TASKS,
  TRIALS_PER_TASK,
} from './suite.js';
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
export const CHECK_DEFS: readonly {
  id: string;
  title: string;
  severity: CheckSeverity;
  description: string;
}[] = [
  {
    id: 'schema',
    title: 'Schema shape',
    severity: 'error',
    description: `Manifest parses as ${BENCH_SCHEMA} with every required block present and correctly typed.`,
  },
  {
    id: 'suite-pin',
    title: 'Suite & environment pins',
    severity: 'error',
    description:
      'Suite name/version, task counts, trials, and the environment-pins digest match the published release — runs against modified forks or corpora are rejected.',
  },
  {
    id: 'bounds',
    title: 'Metric bounds & budgets',
    severity: 'error',
    description: `Rates within [0,100]; agent runs must respect the per-task budgets (${TASK_TIMEOUT_S / 60} min, $${TASK_COST_CAP_USD}).`,
  },
  {
    id: 'trial-grid',
    title: 'Trial-grid alignment',
    severity: 'error',
    description:
      'Every rate must sit on the mathematically achievable grid (m / tasks·trials). Hand-typed "pretty" numbers almost never do — this catches fabricated scores.',
  },
  {
    id: 'consistency',
    title: 'Internal consistency',
    severity: 'error',
    description:
      'pass^5 cannot exceed weighted pass@1; category set must be exactly the eight published categories.',
  },
  {
    id: 'run-id',
    title: 'Run-id recomputation',
    severity: 'error',
    description:
      'The runId is a content hash over agent identity, suite pins, and results. It is recomputed on intake — any post-mint edit to the manifest breaks it.',
  },
  {
    id: 'canary',
    title: 'Canary attestation',
    severity: 'error',
    description:
      'The harness embeds a canary GUID in every task file and scans model output for it. Runs without a clean canary attestation are rejected as contaminated.',
  },
  {
    id: 'duplicate',
    title: 'Duplicate run / trace',
    severity: 'error',
    description:
      'The runId and trace-archive root are checked against every listed run. Resubmitting an existing run — or replaying someone else’s traces — collides here.',
  },
  {
    id: 'near-duplicate',
    title: 'Near-duplicate scores',
    severity: 'warn',
    description:
      'A score vector within one trial-grid step of an existing entry in every category is flagged as a probable relabeled copy and held for manual review.',
  },
  {
    id: 'harness-build',
    title: 'Published harness build',
    severity: 'warn',
    description:
      'The compiled scored-runtime hash must match a published build. Unknown builds can only enter as self-reported: patched code could ship easier verifiers.',
  },
  {
    id: 'identity',
    title: 'Submitter identity',
    severity: 'error',
    description:
      'A contactable submitter (email or HTTPS URL) is required; verified-tier re-execution is coordinated through it. One entry per agent+model+scaffold configuration.',
  },
  {
    id: 'unknown-keys',
    title: 'Unexpected fields',
    severity: 'warn',
    description:
      'Fields outside the schema are flagged — a common vector for spoofed badges and lookalike metrics.',
  },
] as const;

/* ————————————————————————— structural parse ————————————————————————— */

export type ParseIssue = { path: string; message: string };
type ParseResult = { ok: true; data: RunManifest } | { ok: false; issues: ParseIssue[] };

const AGENT_CLASSES = ['agent', 'human-baseline', 'scripted-baseline'] as const;
const PROVENANCE_KINDS = ['reference', 'seed', 'community'] as const;
const TIERS = ['verified', 'self-reported'] as const;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const RUN_ID_RE = /^nbr1_[0-9a-f]{16}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AGENT_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

/**
 * Structural validator for `nexbench.run/2.1`. Returns typed data or a list of
 * path/message issues in the same style the site's zod schema produces, so the
 * `schema` check reads identically across surfaces.
 */
export function parseManifest(input: unknown): ParseResult {
  const issues: ParseIssue[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });

  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const str = (v: unknown, path: string, min = 0, max = Infinity): void => {
    if (typeof v !== 'string') push(path, 'expected string');
    else if (v.length < min) push(path, `must be ≥ ${min} characters`);
    else if (v.length > max) push(path, `must be ≤ ${max} characters`);
  };
  const num = (v: unknown, path: string): void => {
    if (typeof v !== 'number' || Number.isNaN(v)) push(path, 'expected number');
  };
  const intNum = (v: unknown, path: string): void => {
    if (typeof v !== 'number' || !Number.isInteger(v)) push(path, 'expected integer');
  };
  const bool = (v: unknown, path: string): void => {
    if (typeof v !== 'boolean') push(path, 'expected boolean');
  };
  const oneOf = (v: unknown, path: string, opts: readonly string[]): void => {
    if (typeof v !== 'string' || !opts.includes(v)) push(path, `must be one of ${opts.join(', ')}`);
  };
  const re = (v: unknown, path: string, pattern: RegExp, hint: string): void => {
    if (typeof v !== 'string' || !pattern.test(v)) push(path, hint);
  };

  if (!isObj(input)) return { ok: false, issues: [{ path: '(root)', message: 'expected object' }] };

  str(input.schema, 'schema');

  if (!isObj(input.suite)) push('suite', 'expected object');
  else {
    str(input.suite.name, 'suite.name');
    str(input.suite.version, 'suite.version');
    intNum(input.suite.totalTasks, 'suite.totalTasks');
    intNum(input.suite.trialsPerTask, 'suite.trialsPerTask');
  }

  if (!isObj(input.agent)) push('agent', 'expected object');
  else {
    re(input.agent.id, 'agent.id', AGENT_ID_RE, 'lowercase slug');
    str(input.agent.name, 'agent.name', 2, 80);
    str(input.agent.scaffold, 'agent.scaffold', 2, 80);
    str(input.agent.model, 'agent.model', 1, 80);
    oneOf(input.agent.class, 'agent.class', AGENT_CLASSES);
    bool(input.agent.openSource, 'agent.openSource');
  }

  if (!isObj(input.submitter)) push('submitter', 'expected object');
  else {
    str(input.submitter.name, 'submitter.name', 2, 80);
    str(input.submitter.contact, 'submitter.contact', 5, 120);
    if (input.submitter.github !== undefined) str(input.submitter.github, 'submitter.github', 0, 80);
  }

  if (!isObj(input.run)) push('run', 'expected object');
  else {
    re(input.run.completedAt, 'run.completedAt', DATE_RE, 'ISO date');
    str(input.run.harnessVersion, 'run.harnessVersion');
    re(input.run.harnessBuild, 'run.harnessBuild', SHA256_RE, 'sha256:<64 hex>');
    re(input.run.envPinsDigest, 'run.envPinsDigest', SHA256_RE, 'sha256:<64 hex>');
  }

  if (!isObj(input.results)) push('results', 'expected object');
  else {
    if (!isObj(input.results.categories)) push('results.categories', 'expected object');
    else {
      for (const c of categories) {
        const cell = (input.results.categories as Record<string, unknown>)[c.id];
        if (!isObj(cell)) push(`results.categories.${c.id}`, 'expected object');
        else num(cell.passAt1, `results.categories.${c.id}.passAt1`);
      }
    }
    if (!isObj(input.results.metrics)) push('results.metrics', 'expected object');
    else {
      const m = input.results.metrics;
      num(m.passHat5, 'results.metrics.passHat5');
      num(m.svrPer100, 'results.metrics.svrPer100');
      num(m.gasOverspendPct, 'results.metrics.gasOverspendPct');
      num(m.costPerTaskUsd, 'results.metrics.costPerTaskUsd');
      num(m.medianTaskSeconds, 'results.metrics.medianTaskSeconds');
    }
  }

  if (!isObj(input.integrity)) push('integrity', 'expected object');
  else {
    re(input.integrity.runId, 'integrity.runId', RUN_ID_RE, 'nbr1_<16 hex>');
    re(input.integrity.traceRoot, 'integrity.traceRoot', SHA256_RE, 'sha256:<64 hex>');
    bool(input.integrity.canaryClean, 'integrity.canaryClean');
  }

  if (!isObj(input.provenance)) push('provenance', 'expected object');
  else {
    oneOf(input.provenance.kind, 'provenance.kind', PROVENANCE_KINDS);
    oneOf(input.provenance.tier, 'provenance.tier', TIERS);
    if (input.provenance.verifiedBy !== undefined)
      str(input.provenance.verifiedBy, 'provenance.verifiedBy');
    if (input.provenance.verifiedAt !== undefined)
      str(input.provenance.verifiedAt, 'provenance.verifiedAt');
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, data: input as unknown as RunManifest };
}

/* ————————————————————————— validator ————————————————————————— */

const TOP_LEVEL_KEYS = new Set([
  'schema',
  'suite',
  'agent',
  'submitter',
  'run',
  'results',
  'integrity',
  'provenance',
]);

const CONTACT_RE = /(^[^\s@]+@[^\s@]+\.[^\s@]{2,}$)|(^https:\/\/\S{4,}$)/;

function result(id: string, status: CheckStatus, detail: string): CheckResult {
  const def = CHECK_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`unknown check id: ${id}`);
  return { id, title: def.title, severity: def.severity, status, detail };
}

/**
 * Run the full check stack against an untrusted manifest. Pure function of
 * (input, known runs) — identical verdicts in the browser preview, on the
 * intake API, and in `nexbench validate`.
 */
export async function validateManifest(
  input: unknown,
  known: readonly KnownRun[],
): Promise<ValidationReport> {
  const checks: CheckResult[] = [];
  const digest = await manifestDigest(input);

  // 1 · schema
  const parsed = parseManifest(input);
  if (!parsed.ok) {
    const first = parsed.issues
      .slice(0, 3)
      .map((issue) => `${issue.path || '(root)'}: ${issue.message}`)
      .join(' · ');
    checks.push(result('schema', 'fail', first));
    return { ok: false, flagged: false, runId: null, digest, checks };
  }
  const m = parsed.data;
  checks.push(result('schema', 'pass', `parsed as ${m.schema}`));

  // 2 · suite pins
  const suiteProblems: string[] = [];
  if (m.schema !== BENCH_SCHEMA) suiteProblems.push(`schema ${m.schema} ≠ ${BENCH_SCHEMA}`);
  if (m.suite.name !== BENCH_NAME || m.suite.version !== BENCH_VERSION)
    suiteProblems.push(`suite ${m.suite.name}@${m.suite.version} ≠ ${BENCH_NAME}@${BENCH_VERSION}`);
  if (m.suite.totalTasks !== TOTAL_TASKS)
    suiteProblems.push(`totalTasks ${m.suite.totalTasks} ≠ ${TOTAL_TASKS}`);
  if (m.suite.trialsPerTask !== TRIALS_PER_TASK)
    suiteProblems.push(`trials ${m.suite.trialsPerTask} ≠ ${TRIALS_PER_TASK}`);
  if (m.run.envPinsDigest !== ENV_PINS_DIGEST)
    suiteProblems.push('environment-pins digest mismatch');
  checks.push(
    suiteProblems.length
      ? result('suite-pin', 'fail', suiteProblems.join(' · '))
      : result('suite-pin', 'pass', `${BENCH_NAME}@${BENCH_VERSION}, pins match`),
  );

  // 3 · bounds & budgets
  const boundsProblems: string[] = [];
  const isAgent = m.agent.class === 'agent';
  for (const c of categories) {
    const p = m.results.categories[c.id].passAt1;
    if (p < 0 || p > 100) boundsProblems.push(`${c.code} pass@1 ${p} out of [0,100]`);
  }
  const { passHat5, svrPer100, gasOverspendPct, costPerTaskUsd, medianTaskSeconds } =
    m.results.metrics;
  if (passHat5 < 0 || passHat5 > 100) boundsProblems.push(`pass^5 ${passHat5} out of [0,100]`);
  if (svrPer100 < 0 || svrPer100 > 100) boundsProblems.push(`SVR ${svrPer100} out of [0,100]`);
  if (gasOverspendPct < 0 || gasOverspendPct > 1000)
    boundsProblems.push(`gas Δ ${gasOverspendPct}% implausible`);
  if (costPerTaskUsd < 0) boundsProblems.push('negative cost');
  if (medianTaskSeconds <= 0) boundsProblems.push('non-positive wall-clock');
  if (isAgent && costPerTaskUsd > TASK_COST_CAP_USD)
    boundsProblems.push(`cost/task $${costPerTaskUsd} exceeds the $${TASK_COST_CAP_USD} budget`);
  if (isAgent && medianTaskSeconds > TASK_TIMEOUT_S)
    boundsProblems.push(`median wall-clock ${medianTaskSeconds}s exceeds the ${TASK_TIMEOUT_S}s budget`);
  checks.push(
    boundsProblems.length
      ? result('bounds', 'fail', boundsProblems.join(' · '))
      : result('bounds', 'pass', 'all metrics within bounds and budgets'),
  );

  // 4 · trial-grid alignment
  const gridProblems: string[] = [];
  for (const c of categories) {
    const p = m.results.categories[c.id].passAt1;
    if (!isOnTrialGrid(p, c.tasks))
      gridProblems.push(`${c.code} ${p} is not m/${c.tasks * TRIALS_PER_TASK}`);
  }
  if (!isOnTaskGrid(passHat5, TOTAL_TASKS)) gridProblems.push(`pass^5 ${passHat5} off the /${TOTAL_TASKS} grid`);
  if (!isOnTaskGrid(svrPer100, TOTAL_TASKS)) gridProblems.push(`SVR ${svrPer100} off the /${TOTAL_TASKS} grid`);
  checks.push(
    gridProblems.length
      ? result('trial-grid', 'fail', gridProblems.join(' · '))
      : result('trial-grid', 'pass', 'every rate sits on an achievable grid'),
  );

  // 5 · internal consistency
  const scores = Object.fromEntries(
    categories.map((c) => [c.id, m.results.categories[c.id].passAt1]),
  ) as Record<CategoryId, number>;
  const weighted = overallScore(scores);
  checks.push(
    passHat5 > weighted + 1e-6
      ? result('consistency', 'fail', `pass^5 ${passHat5} exceeds weighted pass@1 ${weighted.toFixed(4)}`)
      : result('consistency', 'pass', `pass^5 ${passHat5} ≤ pass@1 ${weighted.toFixed(1)}`),
  );

  // 6 · run-id recomputation
  const expectedRunId = await computeRunId(m);
  checks.push(
    expectedRunId === m.integrity.runId
      ? result('run-id', 'pass', expectedRunId)
      : result(
          'run-id',
          'fail',
          `stored ${m.integrity.runId}, recomputed ${expectedRunId} — manifest was edited after minting`,
        ),
  );

  // 7 · canary
  checks.push(
    m.integrity.canaryClean
      ? result('canary', 'pass', 'canary attestation clean')
      : result('canary', 'fail', 'canary GUID surfaced in model output — contaminated run'),
  );

  // 8 · duplicates
  const dupById = known.find((k) => k.runId === m.integrity.runId);
  const dupByTrace = known.find((k) => k.traceRoot === m.integrity.traceRoot);
  checks.push(
    dupById
      ? result('duplicate', 'fail', `runId already listed (${dupById.agentId})`)
      : dupByTrace
        ? result(
            'duplicate',
            'fail',
            `trace archive already listed under ${dupByTrace.runId} (${dupByTrace.agentId}) — replayed traces`,
          )
        : result('duplicate', 'pass', `no collision across ${known.length} listed runs`),
  );

  // 9 · near-duplicate score vectors
  const nearDupe = known.find((k) => {
    if (k.agentId === m.agent.id) return false;
    return categories.every((c) => {
      const step = 100 / (c.tasks * TRIALS_PER_TASK);
      return Math.abs(k.scores[c.id] - scores[c.id]) < step + 1e-9;
    });
  });
  checks.push(
    nearDupe
      ? result(
          'near-duplicate',
          'flag',
          `score vector within one trial of ${nearDupe.agentId} (max Δ ${maxCategoryDelta(scores, nearDupe.scores).toFixed(3)}) — held for review`,
        )
      : result('near-duplicate', 'pass', 'no listed run within one trial-grid step'),
  );

  // 10 · harness build
  const knownBuild = KNOWN_HARNESS_BUILDS[m.run.harnessVersion];
  checks.push(
    knownBuild === m.run.harnessBuild
      ? result('harness-build', 'pass', `harness ${m.run.harnessVersion} is a published build`)
      : result(
          'harness-build',
          'flag',
          `build ${m.run.harnessBuild.slice(0, 18)}… is not the published ${m.run.harnessVersion} scored runtime — capped at self-reported`,
        ),
  );

  // 11 · identity
  checks.push(
    CONTACT_RE.test(m.submitter.contact)
      ? result('identity', 'pass', `${m.submitter.name} · ${m.submitter.contact}`)
      : result('identity', 'fail', 'contact must be an email or HTTPS URL'),
  );

  // 12 · unknown keys
  const extras =
    input && typeof input === 'object'
      ? Object.keys(input as Record<string, unknown>).filter((k) => !TOP_LEVEL_KEYS.has(k))
      : [];
  checks.push(
    extras.length
      ? result('unknown-keys', 'flag', `unexpected top-level fields: ${extras.join(', ')}`)
      : result('unknown-keys', 'pass', 'no fields outside the schema'),
  );

  const ok = !checks.some((c) => c.severity === 'error' && c.status === 'fail');
  const flagged = checks.some((c) => c.status === 'flag');
  return { ok, flagged, runId: ok ? m.integrity.runId : null, digest, checks };
}
