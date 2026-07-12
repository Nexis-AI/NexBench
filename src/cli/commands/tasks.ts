/** `nexbench tasks` — list the public-dev split (24 of 214), flagging runnable. */

import { categories, PUBLIC_SPLIT, TOTAL_TASKS } from '../../core/suite.js';
import type { CategoryId, Difficulty } from '../../core/types.js';
import { type Args, c, dataPath, fail, loadJson, pad } from '../util.js';

type TaskSpec = {
  id: string;
  category: CategoryId;
  title: string;
  difficulty: Difficulty;
  env: string;
  description: string;
  checker: string;
  runnable: boolean;
};

export function tasksCmd(args: Args): void {
  let specs: TaskSpec[];
  try {
    specs = loadJson<TaskSpec[]>(dataPath('tasks', 'public-dev.json'));
  } catch {
    fail('could not read tasks/public-dev.json');
  }

  const cat = args.flags.category ? String(args.flags.category) : undefined;
  const filtered = cat ? specs.filter((t) => t.category === cat || categoryById(t.category)?.code.toLowerCase() === cat.toLowerCase()) : specs;

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
    return;
  }

  process.stdout.write(`\n${c.bold('NEXBENCH')} public-dev split — ${c.cyan(String(PUBLIC_SPLIT))} public of ${c.cyan(String(TOTAL_TASKS))} total tasks\n`);
  process.stdout.write(c.gray('the remaining tasks are held out and rotate quarterly\n\n'));

  for (const category of categories) {
    const rows = filtered.filter((t) => t.category === category.id);
    if (!rows.length) continue;
    process.stdout.write(`${c.bold(category.code)} ${c.dim(category.label)}\n`);
    for (const t of rows) {
      const run = t.runnable ? c.green('runnable') : c.gray('reference-env');
      process.stdout.write(`  ${pad(t.id, 12)} ${pad(t.difficulty, 8)} ${run}  ${t.title}\n`);
    }
    process.stdout.write('\n');
  }

  const runnable = filtered.filter((t) => t.runnable).length;
  process.stdout.write(c.dim(`${runnable} of these run offline in the bundled local environment (\`nexbench run\`).\n`));
  process.stdout.write(c.dim('The full 214-task suite runs against the reference environment pack — see docs/environments.md.\n'));
}

function categoryById(id: CategoryId) {
  return categories.find((cc) => cc.id === id);
}
