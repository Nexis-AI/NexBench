/**
 * Trace evidence bundles and signed verification attestations.
 *
 * The run manifest remains `nexbench.run/2.1`. Evidence is an additive,
 * independently content-addressed artifact so existing manifest consumers keep
 * working while a verified-run service can prove the trace archive, canary
 * scan, verifier outputs, and final decision.
 */
import { type KeyLike } from 'node:crypto';
import type { CategoryId, RunManifest } from './core/types.js';
import { type EvidenceTaskRecord } from './harness/trace.js';
export declare const EVIDENCE_BUNDLE_SCHEMA: "nexbench.evidence/1.0";
export declare const VERIFICATION_ATTESTATION_SCHEMA: "nexbench.verification-attestation/1.0";
/** MIME type accepted by the durable attachment API; schema identity is in JSON. */
export declare const EVIDENCE_MIME_TYPE: "application/json";
export type EvidenceMode = 'full' | 'public-dev';
export type EvidenceBundle = {
    schema: typeof EVIDENCE_BUNDLE_SCHEMA;
    subject: {
        /** Null only for a public-dev report, which is not leaderboard-eligible. */
        runId: string | null;
        manifestDigest: string | null;
        traceRoot: string;
    };
    suite: {
        name: string;
        version: string;
        totalTasks: number;
        trialsPerTask: number;
        mode: EvidenceMode;
    };
    run: {
        completedAt: string;
        harnessVersion: string;
        harnessBuild: string;
        envPinsDigest: string;
    };
    /** Ordered task records; array order is part of both Merkle roots. */
    tasks: EvidenceTaskRecord[];
    integrity: {
        taskCount: number;
        trialCount: number;
        verifierEvidenceRoot: string;
        canaryClean: boolean;
    };
    generatedAt: string;
};
/** Minimal structural view used to validate an attachment upload receipt. */
export type EvidenceFileDescriptor = {
    id: string;
    name: string;
    attachmentKind: 'document';
    mimeType: typeof EVIDENCE_MIME_TYPE;
    sizeBytes: number;
    url: string;
    ingestion: {
        sha256: string;
        mimeType: string;
        sizeBytes: number;
        storagePath: string;
        status: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
export type EvidenceIssue = {
    code: string;
    path: string;
    message: string;
};
export type EvidenceVerificationReport = {
    ok: boolean;
    /** Stable machine-readable summary, de-duplicated in first-seen order. */
    reasonCodes: string[];
    bundle: EvidenceBundle | null;
    issues: EvidenceIssue[];
    recomputed: {
        traceRoot: string | null;
        verifierEvidenceRoot: string | null;
        canaryClean: boolean | null;
        /** Preferred explicit name; `digest` is retained for 2.1.5 CLI compatibility. */
        evidenceBundleDigest: string | null;
        manifestDigest: string | null;
        digest: string | null;
        results: EvidenceDerivedResults | null;
    };
};
/** Score and operational metrics derived exclusively from the trial archive. */
export type EvidenceDerivedResults = {
    categories: Partial<Record<CategoryId, {
        passAt1: number;
        tasks: number;
    }>>;
    metrics: {
        passHat5: number;
        svrPer100: number;
        gasOverspendPct: number | null;
        costPerTaskUsd: number;
        medianTaskSeconds: number;
    };
};
export type EvidenceParseResult = {
    ok: true;
    data: EvidenceBundle;
} | {
    ok: false;
    issues: EvidenceIssue[];
};
export type BuildEvidenceBundleOptions = {
    records: readonly EvidenceTaskRecord[];
    mode: EvidenceMode;
    completedAt: string;
    generatedAt?: string;
    /** Required for full-suite evidence; forbidden from being inferred. */
    manifest?: RunManifest;
    harnessVersion?: string;
    harnessBuild?: string;
    envPinsDigest?: string;
    trialsPerTask?: number;
};
/**
 * Build a content-addressed evidence bundle. Full bundles are accepted only
 * when their recomputed archive root and canary result already match the exact
 * manifest they accompany.
 */
export declare function buildEvidenceBundle(options: BuildEvidenceBundleOptions): Promise<EvidenceBundle>;
/** Canonical digest used by upload receipts and signed attestations. */
export declare function evidenceBundleDigest(bundle: EvidenceBundle): Promise<string>;
/** Strict structural parser for untrusted worker/API input. */
export declare function parseEvidenceBundle(input: unknown): EvidenceParseResult;
/**
 * Recompute every evidence claim. Passing a manifest additionally proves the
 * bundle belongs to that exact manifest, not merely that it is internally
 * self-consistent.
 */
export declare function verifyEvidenceBundle(input: unknown, manifest?: RunManifest): Promise<EvidenceVerificationReport>;
export type VerificationDecision = {
    verdict: 'verified' | 'rejected';
    issuedAt: string;
    verifier: {
        id: string;
        version: string;
    };
    reasonCodes: string[];
};
export type VerificationAttestation = {
    schema: typeof VERIFICATION_ATTESTATION_SCHEMA;
    subject: {
        runId: string;
        manifestDigest: string;
        traceRoot: string;
        evidenceBundleDigest: string;
    };
    environment: {
        suiteVersion: string;
        harnessVersion: string;
        harnessBuild: string;
        envPinsDigest: string;
    };
    evidence: {
        verifierEvidenceRoot: string;
        taskCount: number;
        trialCount: number;
        canaryClean: boolean;
    };
    decision: VerificationDecision;
    signer: {
        keyId: string;
        algorithm: 'Ed25519';
    };
    /** Base64url Ed25519 signature over `attestationPayload(this)`. */
    signature: string;
};
export type UnsignedVerificationAttestation = Omit<VerificationAttestation, 'signature'>;
/** Canonical signed bytes; the signature field is always excluded. */
export declare function attestationPayload(attestation: VerificationAttestation | UnsignedVerificationAttestation): string;
/** Verify only the detached Ed25519 signature; claim/evidence checks are separate. */
export declare function verifyAttestationSignature(input: unknown, publicKey: KeyLike): boolean;
export declare function createVerificationAttestation(input: {
    manifest: RunManifest;
    evidence: EvidenceBundle;
    decision: VerificationDecision;
    signer: {
        keyId: string;
    };
}, privateKey: KeyLike): Promise<VerificationAttestation>;
export type AttestationVerificationReport = {
    valid: boolean;
    verified: boolean;
    signatureValid: boolean;
    issues: EvidenceIssue[];
};
/** Verify signature, exact manifest binding, and all underlying evidence. */
export declare function verifyVerificationAttestation(input: unknown, publicKey: KeyLike, manifest: RunManifest, evidence: EvidenceBundle): Promise<AttestationVerificationReport>;
