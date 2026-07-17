/** `nexbench init <name>` — scaffold a starter agent you can run immediately. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { c, fail } from '../util.js';
import { agentYaml, ANTHROPIC_ADAPTER_MJS, ANTHROPIC_PACKAGE_JSON, ANTHROPIC_README, TEMPLATES, } from '../templates.js';
const ADAPTER_MJS = `// adapter.mjs — a runnable starter. The harness drives the loop; you return
// one Action per step. Replace these heuristics with your model's planning.
//
//   nexbench run --agent ./agent.yaml
//
// Actions: rpc_call | sign_request | corpus_query | note | submit
// See the Observation/Action reference: https://github.com/Nexis-AI/NexBench

const arr = (obs) => (Array.isArray(obs.last?.data) ? obs.last.data : []);
let revoke = [];

export default {
  // reset() runs before each of the five trials — clear per-trial memory here.
  reset() {
    revoke = [];
  },

  step(obs) {
    switch (obs.task.id) {
      // Approval audit — read allowances, revoke the risky ones, submit.
      case 'NB-SEC-013': {
        if (obs.step === 0) return { type: 'rpc_call', method: 'listApprovals', params: { token: 'USDC' } };
        if (obs.step === 1) revoke = arr(obs).filter((r) => r.risky).map((r) => r.spender);
        const next = revoke.shift();
        return next
          ? { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: next } }
          : { type: 'submit' };
      }

      // Batched payout — pay everyone in one transaction.
      case 'NB-EXE-004': {
        if (obs.step === 0) return { type: 'rpc_call', method: 'getPayees' };
        if (obs.step === 1) return { type: 'sign_request', intent: { kind: 'safe_batch_transfer', token: 'USDC', payees: arr(obs) } };
        return { type: 'submit' };
      }

      // The starter intentionally handles two of six runnable-local tasks.
      // Add cases as your agent learns the remaining task interfaces.
      default:
        return { type: 'submit' };
    }
  },
};
`;
const README = (id) => `# ${id}

A NEXBENCH agent scaffold. The adapter is a step function the harness drives.

## Run

\`\`\`bash
nexbench run --agent ./agent.yaml --trials 5
nexbench report            # re-print the last run
\`\`\`

Out of the box the starter solves \`NB-SEC-013\` and \`NB-EXE-004\`. The catalog
contains 6 \`runnable-local\` tasks and 18 \`metadata-only\` specifications;
\`nexbench run\` executes only the six local tasks.

## Next

- Docs & the full Observation/Action reference: https://github.com/Nexis-AI/NexBench
- Prefer TypeScript or another language? Point \`adapter:\` at a compiled \`.js\`,
  or set \`endpoint:\` to an HTTP \`/step\` server (any language).
`;
export function initCmd(args) {
    const name = args._[0];
    if (!name)
        fail('usage: nexbench init <name> [--template heuristic|anthropic]');
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(name))
        fail('name must be a simple slug (letters, digits, dashes)');
    if (existsSync(name))
        fail(`${name} already exists`);
    const template = String(args.flags.template ?? 'heuristic');
    if (!TEMPLATES.includes(template))
        fail(`unknown template "${template}" — choose one of: ${TEMPLATES.join(', ')}`);
    mkdirSync(name, { recursive: true });
    const id = name.toLowerCase();
    writeFileSync(join(name, 'agent.yaml'), agentYaml(id, './adapter.mjs'));
    if (template === 'anthropic') {
        // A real-model agent. The scaffolded project owns its provider SDK; the
        // nexbench package itself stays dependency-free.
        writeFileSync(join(name, 'adapter.mjs'), ANTHROPIC_ADAPTER_MJS);
        writeFileSync(join(name, 'package.json'), ANTHROPIC_PACKAGE_JSON(id));
        writeFileSync(join(name, 'README.md'), ANTHROPIC_README(id));
        process.stdout.write(`${c.green('created')} ${name}/ ${c.gray('(agent.yaml · adapter.mjs · package.json · README.md)')}\n`);
        process.stdout.write(`\n  ${c.bold('cd')} ${name} && ${c.bold('npm install')}\n`);
        process.stdout.write(`  ${c.bold('export')} ANTHROPIC_API_KEY=sk-ant-…\n`);
        process.stdout.write(`  ${c.bold('nexbench run')} --agent ./agent.yaml\n\n`);
        return;
    }
    writeFileSync(join(name, 'adapter.mjs'), ADAPTER_MJS);
    writeFileSync(join(name, 'README.md'), README(id));
    process.stdout.write(`${c.green('created')} ${name}/ ${c.gray('(agent.yaml · adapter.mjs · README.md)')}\n`);
    process.stdout.write(`\n  ${c.bold('cd')} ${name} && ${c.bold('nexbench run')} --agent ./agent.yaml\n`);
    process.stdout.write(`  ${c.gray('want a real LLM agent? nexbench init <name> --template anthropic')}\n\n`);
}
