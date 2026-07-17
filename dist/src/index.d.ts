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
export * from './core/index.js';
export * from './env/index.js';
export * from './evidence.js';
export { runSuite, type DevReport, type DevTaskResult, type RunOptions, } from './harness/run.js';
export { hashSeed, mulberry32 } from './harness/rng.js';
export { traceRoot, canaryClean, taskLeaf, createVerifierEvidence, verifierEvidencePayload, verifierEvidenceRoot, TASK_TRACE_SCHEMA, TRACE_PRODUCER, VERIFIER_EVIDENCE_SCHEMA, type EvidenceTaskRecord, type EvidenceTrialRecord, type VerifierEvidence, type TaskRecord, type TrialRecord, type StepRecord, } from './harness/trace.js';
export { ScriptedBaseline, scriptedBaseline, isMalicious } from './agents/scripted-baseline.js';
export { ExampleAgent, exampleAgent } from './agents/example-agent.js';
