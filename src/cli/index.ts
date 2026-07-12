#!/usr/bin/env node
/**
 * The `nexbench` command-line interface. Zero-dependency: a tiny arg parser
 * dispatches to the command modules. Run `nexbench help` for the command list.
 */

import { BENCH_NAME, BENCH_REPO_HREF, BENCH_VERSION } from '../core/suite.js';
import { pinsCmd } from './commands/pins.js';
import { runCmd } from './commands/run.js';
import { submitCmd } from './commands/submit.js';
import { tasksCmd } from './commands/tasks.js';
import { validateCmd } from './commands/validate.js';
import { mintCmd } from './commands/mint.js';
import { verifyCmd } from './commands/verify.js';
import { parseArgs, c } from './util.js';

const HELP = `${c.bold('NEXBENCH')} ${BENCH_VERSION} — the reproducible benchmark for autonomous Web3 agents

${c.bold('USAGE')}
  nexbench <command> [options]

${c.bold('COMMANDS')}
  run          Run the runnable public-dev suite with an agent and score it
  tasks        List the public-dev task split (24 of 214), runnable flagged
  validate     Run the 12 intake checks against a run manifest
  verify       Recompute a manifest's run id, digest, and grid alignment
  mint         Assemble a hash-valid manifest from a run draft
  pins         Show the pinned environment set, or recompute its digest
  submit       Validate locally, then submit a manifest to the leaderboard
  help         Show this help; \`nexbench help <command>\` for details
  version      Print the version

${c.bold('EXAMPLES')}
  nexbench run --agent scripted            ${c.gray('# reference baseline over the local suite')}
  nexbench run --agent ./my-adapter.js     ${c.gray('# your adapter (default export)')}
  nexbench run --agent http://localhost:8700/step
  nexbench validate results/nex-t1.json
  nexbench pins --digest

${c.gray(BENCH_REPO_HREF)}
`;

const COMMAND_HELP: Record<string, string> = {
  run: `nexbench run [--agent scripted|example|<path>|<url>] [--trials N] [--out <dir>] [--json]
  Runs the runnable public-dev tasks (offline, deterministic) and prints a
  scorecard. --agent accepts a built-in ("scripted", "example"), a path to a JS
  module with a default StepFn/Agent export, or an HTTP /step endpoint URL.
  Writes runs/<stamp>/dev-report.json and trace.json.`,
  tasks: `nexbench tasks [--category <id|code>] [--json]
  Lists the 24 public-dev tasks grouped by category and flags which run offline.`,
  validate: `nexbench validate <manifest.json> [--known <dir>] [--json]
  Runs all twelve intake checks and prints a verdict. Exit code 0 = accepted.`,
  verify: `nexbench verify <manifest.json> [--json]
  Recomputes the run id and manifest digest and checks trial-grid alignment.`,
  mint: `nexbench mint --from <draft.json> [--out <manifest.json>]
  Assembles a complete, hash-valid manifest (snaps rates to the grid, computes
  the run id) from a draft produced by a full run.`,
  pins: `nexbench pins [--digest] [--json]
  Prints the pinned environment set. --digest recomputes and compares the digest.`,
  submit: `nexbench submit <manifest.json> [--endpoint <url>] [--yes]
  Validates locally, then (with --yes) POSTs the manifest to the leaderboard.`,
};

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);

  switch (cmd) {
    case 'run':
      return runCmd(args);
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
      process.stdout.write(`${BENCH_NAME} ${BENCH_VERSION}\n`);
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
  process.stderr.write(`${c.red('fatal')} ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
