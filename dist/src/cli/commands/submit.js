/** `nexbench submit <manifest.json>` — validate locally, then POST to intake. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { SUBMIT_ENDPOINT } from '../../core/suite.js';
import { parseManifest, validateManifest } from '../../core/validate.js';
import { EVIDENCE_MIME_TYPE, verifyEvidenceBundle, } from '../../evidence.js';
import { c, dataPath, fail, loadJson } from '../util.js';
import { loadKnownRuns } from './validate.js';
export async function submitCmd(args) {
    const endpoint = String(args.flags.endpoint ?? SUBMIT_ENDPOINT);
    const token = String(args.flags.token ?? process.env.NEXBENCH_TOKEN ?? '');
    if (args.flags.status) {
        return statusSubmission(String(args.flags.status), endpoint, token, Boolean(args.flags.json));
    }
    const file = args._[0];
    if (!file)
        fail('usage: nexbench submit <manifest.json> [--evidence <bundle.json>] [--token <token>] [--idempotency-key <key>] [--endpoint <url>] [--yes]');
    let manifest;
    try {
        manifest = loadJson(file);
    }
    catch (err) {
        fail(`could not read ${file}: ${err.message}`);
    }
    // Validate against the same checks the intake API enforces, so a submission
    // never leaves the machine unless it would be accepted.
    const known = loadKnownRuns(String(args.flags.known ?? dataPath('results')));
    const report = await validateManifest(manifest, known);
    if (!report.ok) {
        process.stderr.write(c.red('local validation failed — not submitting. Run `nexbench validate` for details.\n'));
        for (const chk of report.checks.filter((x) => x.severity === 'error' && x.status === 'fail')) {
            process.stderr.write(`  ${c.red('✗')} ${chk.title}: ${chk.detail}\n`);
        }
        process.exit(1);
    }
    const parsed = parseManifest(manifest);
    if (!parsed.ok)
        fail('manifest became invalid after local validation');
    let evidence;
    let evidenceDigest;
    let evidenceUploadDigest;
    let evidenceBytes;
    if (args.flags.evidence) {
        const path = String(args.flags.evidence);
        try {
            evidenceBytes = readFileSync(path);
            evidence = JSON.parse(Buffer.from(evidenceBytes).toString('utf8'));
            evidenceUploadDigest = uploadBytesDigest(evidenceBytes);
        }
        catch (err) {
            fail(`could not read evidence bundle ${path}: ${err.message}`);
        }
        const evidenceReport = await verifyEvidenceBundle(evidence, parsed.data);
        if (!evidenceReport.ok) {
            fail(`evidence verification failed: ${evidenceReport.issues
                .slice(0, 3)
                .map((issue) => `${issue.path}: ${issue.message}`)
                .join(' · ')}`);
        }
        evidenceDigest = evidenceReport.recomputed.digest ?? undefined;
    }
    const idempotencyKey = String(args.flags['idempotency-key'] ?? `nexbench:${parsed.data.integrity.runId}:${report.digest}`);
    process.stdout.write(`${c.green('✓')} local validation passed — run id ${c.cyan(report.runId ?? '')}\n`);
    if (evidenceDigest)
        process.stdout.write(`${c.green('✓')} evidence verified — ${c.gray(evidenceDigest)}\n`);
    if (report.flagged)
        process.stdout.write(c.yellow('  note: warn-level flags present — the entry will be held for manual review.\n'));
    if (!args.flags.yes) {
        process.stdout.write(`\n${c.bold('dry run.')} This would POST the manifest to:\n  ${endpoint}\n`);
        if (evidence)
            process.stdout.write(`and upload the evidence bundle to:\n  ${evidenceEndpointFor(endpoint)}\n`);
        process.stdout.write(`idempotency key:\n  ${idempotencyKey}\n`);
        process.stdout.write(c.dim('Re-run with --yes to submit for real.\n'));
        return;
    }
    if (!evidence || !evidenceBytes || !evidenceDigest || !evidenceUploadDigest) {
        fail('durable submission requires --evidence <bundle.json>');
    }
    if (!token) {
        fail('authenticated submission requires --token or NEXBENCH_TOKEN');
    }
    const headers = {
        authorization: `Bearer ${token}`,
        'idempotency-key': idempotencyKey,
    };
    let evidenceRef;
    if (evidence && evidenceBytes && evidenceDigest && evidenceUploadDigest) {
        const form = new FormData();
        form.append('file', new Blob([evidenceBytes], { type: EVIDENCE_MIME_TYPE }), basename(String(args.flags.evidence)));
        const uploadEndpoint = evidenceEndpointFor(endpoint);
        process.stdout.write(c.dim(`\nuploading evidence to ${uploadEndpoint}…\n`));
        let upload;
        try {
            upload = await fetch(uploadEndpoint, { method: 'POST', headers, body: form });
        }
        catch (err) {
            fail(`evidence upload network error: ${err.message}`);
        }
        const uploadText = await upload.text();
        if (!upload.ok)
            fail(`evidence upload returned ${upload.status}: ${uploadText.slice(0, 400)}`);
        try {
            const response = JSON.parse(uploadText);
            evidenceRef = response.data;
        }
        catch (err) {
            fail(`evidence upload returned invalid JSON: ${err.message}`);
        }
        const receiptDigest = normalizeSha256(evidenceRef?.ingestion?.sha256);
        if (!evidenceRef?.id || receiptDigest !== evidenceUploadDigest) {
            fail(`evidence receipt mismatch: expected uploaded bytes ${evidenceUploadDigest}, received ${receiptDigest ?? 'no digest'}`);
        }
    }
    process.stdout.write(c.dim(`\nsubmitting to ${endpoint}…\n`));
    let res;
    try {
        res = await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify(evidenceRef ? { manifest, evidence: evidenceRef } : manifest),
        });
    }
    catch (err) {
        fail(`network error: ${err.message}`);
    }
    const text = await res.text();
    if (!res.ok)
        fail(`intake returned ${res.status}: ${text.slice(0, 400)}`);
    process.stdout.write(`${c.green('submitted.')} ${text.slice(0, 600)}\n`);
}
function normalizeSha256(value) {
    if (!value)
        return undefined;
    return value.startsWith('sha256:') ? value : `sha256:${value}`;
}
/** Digest the exact uploaded bytes; formatting is intentionally significant. */
export function uploadBytesDigest(bytes) {
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
/** Replace a `/submissions` endpoint with its sibling durable evidence store. */
export function evidenceEndpointFor(submissionEndpoint) {
    const url = new URL(submissionEndpoint);
    const trimmed = url.pathname.replace(/\/+$/, '');
    url.pathname = trimmed.endsWith('/submissions')
        ? `${trimmed.slice(0, -'/submissions'.length)}/evidence`
        : `${trimmed}/evidence`;
    return url.toString().replace(/\/$/, '');
}
async function statusSubmission(submissionId, endpoint, token, json) {
    if (!token)
        fail('submission status requires --token or NEXBENCH_TOKEN');
    const statusUrl = `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(submissionId)}`;
    let response;
    try {
        response = await fetch(statusUrl, {
            headers: { authorization: `Bearer ${token}` },
        });
    }
    catch (err) {
        fail(`status network error: ${err.message}`);
    }
    const body = await response.text();
    if (!response.ok)
        fail(`status returned ${response.status}: ${body.slice(0, 400)}`);
    if (json) {
        process.stdout.write(`${body}\n`);
        return;
    }
    try {
        const status = JSON.parse(body);
        process.stdout.write(`${c.bold('NEXBENCH submission')} ${submissionId}\n${JSON.stringify(status, null, 2)}\n`);
    }
    catch {
        process.stdout.write(`${body}\n`);
    }
}
