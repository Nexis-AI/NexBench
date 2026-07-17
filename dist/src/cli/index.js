#!/usr/bin/env node
/**
 * The `nexbench` command-line interface. Zero-dependency: a tiny arg parser
 * dispatches to the command modules. Run `nexbench help` for the command list.
 */
import { BENCH_NAME, BENCH_REPO_HREF, BENCH_SCHEMA, BENCH_VERSION, PACKAGE_VERSION, } from '../core/suite.js';
import { initCmd } from './commands/init.js';
import { pinsCmd } from './commands/pins.js';
import { reportCmd } from './commands/report.js';
import { runCmd } from './commands/run.js';
import { submitCmd } from './commands/submit.js';
import { tasksCmd } from './commands/tasks.js';
import { validateCmd } from './commands/validate.js';
import { mintCmd } from './commands/mint.js';
import { verifyCmd } from './commands/verify.js';
import { parseArgs, c } from './util.js';
const HELP = `${c.bold('NEXBENCH')} CLI ${PACKAGE_VERSION} · suite ${BENCH_VERSION} — the reproducible benchmark for autonomous Web3 agents

${c.bold('USAGE')}
  nexbench <command> [options]

${c.bold('COMMANDS')}
  init         Scaffold a starter agent (agent.yaml + adapter) you can run now
  run          Run the runnable public-dev suite with an agent and score it
  report       Re-print the scorecard from a saved run
  tasks        List 6 runnable-local + 18 metadata-only public task specs
  validate     Run the 12 intake checks against a run manifest
  verify       Recompute manifest and optional evidence/attestation integrity
  mint         Assemble a hash-valid manifest from a run draft
  pins         Show the pinned environment set, or recompute its digest
  submit       Validate, upload evidence, and submit with idempotency/auth
  help         Show this help; \`nexbench help <command>\` for details
  version      Print the version

${c.bold('EXAMPLES')}
  nexbench init my-agent && cd my-agent    ${c.gray('# scaffold, then:')}
  nexbench run --agent ./agent.yaml --trials 5
  nexbench run --agent scripted            ${c.gray('# reference baseline over the local suite')}
  nexbench run --agent http://localhost:8700/step
  nexbench validate results/nex-t1.json
  nexbench pins --digest

${c.gray(BENCH_REPO_HREF)}
`;
const COMMAND_HELP = {
    init: `nexbench init <name>
  Scaffolds <name>/ with an agent.yaml, a runnable adapter.mjs starter, and a
  README. Then: cd <name> && nexbench run --agent ./agent.yaml`,
    run: `nexbench run [--agent scripted|example|<path>|<agent.yaml>|<url>] [--trials N] [--out <dir>] [--json]
  Runs the 6 runnable-local public-dev tasks (offline, deterministic) and prints a
  scorecard. --agent accepts a built-in ("scripted", "example"), an agent.yaml
  config, a path to a JS module with a default StepFn/Agent export, or an HTTP
  /step endpoint URL. Writes dev-report.json, trace.json, and evidence.json.`,
    report: `nexbench report [<dir>] [--json]
  Re-prints the scorecard from a saved run. Defaults to the most recent run
  under runs/.`,
    tasks: `nexbench tasks [--category <id|code>] [--json]
  Lists the 24 public task specs: 6 runnable-local and 18 metadata-only.`,
    validate: `nexbench validate <manifest.json> [--known <dir>] [--json]
  Runs all twelve intake checks and prints a verdict. Exit code 0 = accepted.`,
    verify: `nexbench verify [<manifest.json>] [--evidence <bundle.json>] [--attestation <file> --public-key <pem>] [--json]
  Recomputes the run id and manifest digest, checks trial-grid alignment, and
  verifies a trace-evidence bundle. Evidence can be checked by itself; a signed
  attestation additionally requires its manifest.`,
    mint: `nexbench mint --from <draft.json> [--out <manifest.json>]
  Assembles a complete, hash-valid manifest (snaps rates to the grid, computes
  the run id) from a draft produced by a full run.`,
    pins: `nexbench pins [--digest] [--json]
  Prints the pinned environment set. --digest recomputes and compares the digest.`,
    submit: `nexbench submit <manifest.json> [--evidence <bundle.json>] [--token <token>] [--idempotency-key <key>] [--endpoint <url>] [--yes]
  Validates locally; with --evidence, uploads the bundle first and submits its
  durable attachment reference. Real submissions use Bearer auth from --token
  or NEXBENCH_TOKEN and an explicit or deterministic Idempotency-Key.

nexbench submit --status <submissionId> [--token <token>] [--endpoint <url>] [--json]
  Fetches the durable intake/verification status for a previous submission.`,
};
async function main() {
    const [, , cmd, ...rest] = process.argv;
    const args = parseArgs(rest);
    switch (cmd) {
        case 'init':
            return initCmd(args);
        case 'run':
            return runCmd(args);
        case 'report':
            return reportCmd(args);
        case 'tasks':
            return tasksCmd(args);
        case 'validate':
            return validateCmd(args);
        case 'verify':
            return verifyCmd(args);
        case 'mint':
            return mintCmd(args);
        case 'pins':
            return pinsCmd(args);
        case 'submit':
            return submitCmd(args);
        case 'version':
        case '--version':
        case '-v':
            process.stdout.write(`${BENCH_NAME} CLI ${PACKAGE_VERSION} (suite ${BENCH_VERSION}; schema ${BENCH_SCHEMA})\n`);
            return;
        case 'help':
        case '--help':
        case '-h':
        case undefined: {
            const topic = args._[0];
            process.stdout.write(topic && COMMAND_HELP[topic] ? `${COMMAND_HELP[topic]}\n` : HELP);
            return;
        }
        default:
            process.stderr.write(`unknown command: ${cmd}\nrun \`nexbench help\`\n`);
            process.exit(1);
    }
}
main().catch((err) => {
    process.stderr.write(`${c.red('fatal')} ${err.stack ?? String(err)}\n`);
    process.exit(1);
});
