/**
 * NEXBENCH — the reproducible benchmark for autonomous Web3 agents.
 *
 * Public API. Adapters import the agent contract types from here:
 *
 *   import type { Observation, Action } from 'nexbench';
 *
 * and tooling imports the core (suite pins, integrity, scoring, validation,
 * manifest assembly) plus the harness (runSuite) for programmatic runs.
 */

// Core: the "science" — pins, types, integrity hashing, scoring, validation.
export * from './core/index.js';

// Agent interface + the bundled local environment.
export * from './env/index.js';

// Versioned trace evidence and signed verification attestations.
export * from './evidence.js';

// Harness: the run loop and trace primitives.
export {
  runSuite,
  type DevReport,
  type DevTaskResult,
  type RunOptions,
} from './harness/run.js';
export { hashSeed, mulberry32 } from './harness/rng.js';
export {
  traceRoot,
  canaryClean,
  taskLeaf,
  createVerifierEvidence,
  verifierEvidencePayload,
  verifierEvidenceRoot,
  TASK_TRACE_SCHEMA,
  TRACE_PRODUCER,
  VERIFIER_EVIDENCE_SCHEMA,
  type EvidenceTaskRecord,
  type EvidenceTrialRecord,
  type VerifierEvidence,
  type TaskRecord,
  type TrialRecord,
  type StepRecord,
} from './harness/trace.js';

// Reference agents.
export { ScriptedBaseline, scriptedBaseline, isMalicious } from './agents/scripted-baseline.js';
export { ExampleAgent, exampleAgent } from './agents/example-agent.js';
