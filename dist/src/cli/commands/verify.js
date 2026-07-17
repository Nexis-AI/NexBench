/** `nexbench verify <manifest.json>` — recompute the integrity fields. */
import { readFileSync } from 'node:fs';
import { categories, TOTAL_TASKS, TRIALS_PER_TASK } from '../../core/suite.js';
import { computeRunId, isOnTaskGrid, isOnTrialGrid, manifestDigest } from '../../core/integrity.js';
import { parseManifest } from '../../core/validate.js';
import { verifyEvidenceBundle, verifyVerificationAttestation, } from '../../evidence.js';
import { c, fail, loadJson, statusMark } from '../util.js';
export async function verifyCmd(args) {
    const file = args._[0];
    if (!file && !args.flags.evidence)
        fail('usage: nexbench verify [<manifest.json>] [--evidence <bundle.json>] [--attestation <file> --public-key <pem>] [--json]');
    let m;
    if (file) {
        let raw;
        try {
            raw = loadJson(file);
        }
        catch (err) {
            fail(`could not read ${file}: ${err.message}`);
        }
        const parsed = parseManifest(raw);
        if (!parsed.ok) {
            fail(`not a valid manifest: ${parsed.issues.slice(0, 3).map((i) => `${i.path}: ${i.message}`).join(' · ')}`);
        }
        m = parsed.data;
    }
    const recomputed = m ? await computeRunId(m) : undefined;
    const digest = m ? await manifestDigest(m) : undefined;
    const runIdOk = m ? recomputed === m.integrity.runId : true;
    const gridOk = m
        ? categories.every((cat) => isOnTrialGrid(m.results.categories[cat.id].passAt1, cat.tasks)) &&
            isOnTaskGrid(m.results.metrics.passHat5, TOTAL_TASKS) &&
            isOnTaskGrid(m.results.metrics.svrPer100, TOTAL_TASKS)
        : true;
    let evidenceReport;
    let evidence;
    if (args.flags.evidence) {
        try {
            evidence = loadJson(String(args.flags.evidence));
        }
        catch (err) {
            fail(`could not read evidence bundle: ${err.message}`);
        }
        evidenceReport = await verifyEvidenceBundle(evidence, m);
    }
    let attestationReport;
    if (args.flags.attestation) {
        if (!m)
            fail('--attestation requires a manifest path');
        if (!evidence)
            fail('--attestation requires --evidence <bundle.json>');
        if (!args.flags['public-key'])
            fail('--attestation requires --public-key <pem>');
        let attestation;
        let publicKey;
        try {
            attestation = loadJson(String(args.flags.attestation));
            publicKey = readFileSync(String(args.flags['public-key']), 'utf8');
        }
        catch (err) {
            fail(`could not read attestation/public key: ${err.message}`);
        }
        attestationReport = await verifyVerificationAttestation(attestation, publicKey, m, evidence);
    }
    const ok = runIdOk &&
        gridOk &&
        (evidenceReport?.ok ?? true) &&
        (attestationReport?.verified ?? true);
    if (args.flags.json) {
        const evidenceSummary = evidenceReport
            ? (({ bundle: _bundle, ...summary }) => summary)(evidenceReport)
            : undefined;
        process.stdout.write(`${JSON.stringify({
            ...(m
                ? {
                    runId: m.integrity.runId,
                    recomputed,
                    runIdOk,
                    gridOk,
                    digest,
                }
                : {}),
            ...(evidenceSummary ? { evidence: evidenceSummary } : {}),
            ...(attestationReport ? { attestation: attestationReport } : {}),
        }, null, 2)}\n`);
        process.exit(ok ? 0 : 1);
    }
    process.stdout.write(`\n${c.bold('NEXBENCH verify')} · ${file ?? String(args.flags.evidence)}\n\n`);
    if (m) {
        process.stdout.write(`  ${statusMark(runIdOk ? 'pass' : 'fail')} run id       stored ${m.integrity.runId}\n`);
        process.stdout.write(`               recomputed ${recomputed}\n`);
        process.stdout.write(`  ${statusMark(gridOk ? 'pass' : 'fail')} trial grid   every rate on the m/(tasks·${TRIALS_PER_TASK}) grid\n`);
        process.stdout.write(`  ${c.gray('·')} digest       ${c.gray(digest)}\n\n`);
    }
    if (evidenceReport) {
        process.stdout.write(`  ${statusMark(evidenceReport.ok ? 'pass' : 'fail')} evidence     ${evidenceReport.recomputed.digest ?? 'invalid bundle'}\n`);
        for (const issue of evidenceReport.issues.slice(0, 5)) {
            process.stdout.write(`               ${c.red(issue.path)}: ${issue.message}\n`);
        }
    }
    if (attestationReport) {
        process.stdout.write(`  ${statusMark(attestationReport.verified ? 'pass' : 'fail')} attestation  signature=${attestationReport.signatureValid} verified=${attestationReport.verified}\n`);
    }
    process.stdout.write('\n');
    process.exit(ok ? 0 : 1);
}
