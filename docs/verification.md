# Verified-run evidence and attestations

The stable leaderboard manifest remains `nexbench.run/2.1`. Package/harness 2.1.5 adds two
detached artifacts so a verification service can prove a run instead of trusting placeholder
roots or a `provenance.tier` string:

- `nexbench.evidence/1.0` — the complete ordered task/trial archive.
- `nexbench.verification-attestation/1.0` — an Ed25519-signed verification decision.

Their JSON Schemas are published under [`schemas/`](../schemas). The TypeScript types and
builders are exported from the `nexbench` package root.

## Evidence bundle

```jsonc
{
  "schema": "nexbench.evidence/1.0",
  "subject": {
    "runId": "nbr1_…",
    "manifestDigest": "sha256:…",
    "traceRoot": "sha256:…"
  },
  "suite": {
    "name": "NEXBENCH", "version": "2.1",
    "totalTasks": 214, "trialsPerTask": 5, "mode": "full"
  },
  "run": {
    "completedAt": "2026-07-16", "harnessVersion": "2.1.5",
    "harnessBuild": "sha256:…", "envPinsDigest": "sha256:…"
  },
  "tasks": [/* ordered EvidenceTaskRecord values */],
  "integrity": {
    "taskCount": 214, "trialCount": 1070,
    "verifierEvidenceRoot": "sha256:…", "canaryClean": true
  },
  "generatedAt": "2026-07-16T12:00:00.000Z"
}
```

`mode: "full"` requires non-null `runId` and `manifestDigest`; every subject, suite, run, and
integrity field must match the exact manifest. A `public-dev` bundle intentionally has null
`runId`/`manifestDigest`, contains only the six runnable-local tasks, and is never eligible for
leaderboard verification.

### Per-trial verifier evidence

Every trial includes:

```jsonc
{
  "schema": "nexbench.verifier-evidence/1.0",
  "taskId": "NB-…",
  "trial": 0,
  "verifier": { "id": "NB-…/programmatic-checker", "version": "2.1", "build": "sha256:…" },
  "verdict": { "passed": true, "violation": false },
  "evidenceDigest": "sha256:…"
}
```

`evidenceDigest` is SHA-256 over UTF-8 `canonicalJson({taskId, trial, seed, outcome, steps})`.
The verifier verdict must equal `outcome.passed`/`outcome.violation`, so neither side can be
altered independently. Full-suite outcomes also carry per-trial `gasOverspendPct`; without it,
the headline gas metric cannot be reproduced and verification fails.

## Canonicalization and roots

All digest inputs use `canonicalJson`: object keys sorted recursively, array order preserved,
and `undefined` omitted. Digests are lowercase SHA-256 with the `sha256:` prefix.

The trace leaf for each ordered task is:

```text
canonicalJson({
  schema: "nexbench.task-trace/2.1",
  id, category, title, difficulty, trials, passAt1, passAll
})
```

`traceRoot` is the Merkle root of those leaves in task order. Each leaf is first SHA-256 hashed.
At every level, adjacent lowercase child hex strings are concatenated and SHA-256 hashed. An
odd final child is duplicated as its own right sibling. `verifierEvidenceRoot` applies the same
algorithm to canonical verifier-evidence objects in task order, then trial order.

`manifestDigest = sha256(canonicalJson(manifest))` and
`evidenceBundleDigest = sha256(canonicalJson(bundle))`. The latter includes `generatedAt`, so
it identifies the exact uploaded artifact; `traceRoot` remains stable for identical task records.

The canary scan canonicalizes and scans every agent-authored `Action`, including RPC params and
signing intents—not only notes and final answers.

The verifier also derives every score from the archive: each task's `passAt1`/`passAll`, all
eight category rates, `passHat5`, task-level SVR (a task counts once if any trial violates), mean
gas overspend, mean cost, and median trial seconds. Full evidence must contain the published
task count for every category, and these derived values must match the manifest. A self-consistent
Merkle archive with invented headline scores is therefore rejected.

## Signed verification attestation

```jsonc
{
  "schema": "nexbench.verification-attestation/1.0",
  "subject": {
    "runId": "nbr1_…", "manifestDigest": "sha256:…",
    "traceRoot": "sha256:…", "evidenceBundleDigest": "sha256:…"
  },
  "environment": {
    "suiteVersion": "2.1", "harnessVersion": "2.1.5",
    "harnessBuild": "sha256:…", "envPinsDigest": "sha256:…"
  },
  "evidence": {
    "verifierEvidenceRoot": "sha256:…",
    "taskCount": 214, "trialCount": 1070, "canaryClean": true
  },
  "decision": {
    "verdict": "verified", "issuedAt": "2026-07-16T12:30:00.000Z",
    "verifier": { "id": "nexbench-reference-service", "version": "1.0.0" },
    "reasonCodes": []
  },
  "signer": { "keyId": "nexbench-production-1", "algorithm": "Ed25519" },
  "signature": "<base64url>"
}
```

The signature is Ed25519 over UTF-8 `canonicalJson(attestation without signature)`. `keyId`
resolves through the verifier service's trusted public-key registry; public keys are not accepted
from the submitted bundle. `verifyAttestationSignature` checks only the detached signature.
`verifyVerificationAttestation` additionally recomputes and compares every manifest and evidence
claim.

A `verified` decision is valid only when the archive contains exactly `totalTasks ×
trialsPerTask` trials, every verifier record and digest is complete, both Merkle roots recompute,
all manifest scores re-derive from the trials, the canary is clean, the manifest run id
recomputes, and the registered-key signature verifies.

## Worker API

```ts
import {
  parseEvidenceBundle,
  verifyEvidenceBundle,
  evidenceBundleDigest,
  verifyAttestationSignature,
  verifyVerificationAttestation,
} from 'nexbench';

const parsed = parseEvidenceBundle(untrustedJson);
if (!parsed.ok) throw new Error(parsed.issues.map((issue) => issue.code).join(','));

const report = await verifyEvidenceBundle(parsed.data, manifest);
if (!report.ok) throw new Error(report.reasonCodes.join(','));
```

## Durable intake sequence

1. Validate the `nexbench.run/2.1` manifest locally.
2. Parse and fully recompute the evidence bundle against that manifest.
3. Upload multipart field `file` to `/evidence`; retain its content-addressed attachment ref.
4. POST `{ manifest, evidence: attachmentRef }` to `/submissions` with Bearer auth and an
   `Idempotency-Key` (default `nexbench:<runId>:<manifestDigest>`).
5. Re-execute the agent in the pinned reference environment.
6. Rebuild and compare the evidence, apply canary/verifier/policy checks, and record the decision.
7. Sign the final attestation with an approved service key; only then promote to verified.

The CLI implements steps 1–4 with `nexbench submit --evidence ...`; it never handles a verifier
private key.
