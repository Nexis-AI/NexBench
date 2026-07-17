/** `nexbench tasks` — classify the 24 public specs by actual availability. */
import { categories, PUBLIC_METADATA_ONLY_TASKS, PUBLIC_RUNNABLE_TASKS, PUBLIC_SPLIT, TOTAL_TASKS, } from '../../core/suite.js';
import { c, dataPath, fail, loadJson, pad } from '../util.js';
export function tasksCmd(args) {
    let specs;
    try {
        specs = loadJson(dataPath('tasks', 'public-dev.json'));
    }
    catch {
        fail('could not read tasks/public-dev.json');
    }
    const runnable = specs.filter((task) => task.availability === 'runnable-local');
    const metadataOnly = specs.filter((task) => task.availability === 'metadata-only');
    const inconsistent = specs.filter((task) => task.runnable !== (task.availability === 'runnable-local'));
    if (specs.length !== PUBLIC_SPLIT ||
        runnable.length !== PUBLIC_RUNNABLE_TASKS ||
        metadataOnly.length !== PUBLIC_METADATA_ONLY_TASKS ||
        inconsistent.length > 0) {
        fail(`invalid public task catalog: expected ${PUBLIC_RUNNABLE_TASKS} runnable-local + ${PUBLIC_METADATA_ONLY_TASKS} metadata-only = ${PUBLIC_SPLIT}`);
    }
    const cat = args.flags.category ? String(args.flags.category) : undefined;
    const filtered = cat ? specs.filter((t) => t.category === cat || categoryById(t.category)?.code.toLowerCase() === cat.toLowerCase()) : specs;
    if (args.flags.json) {
        process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
        return;
    }
    process.stdout.write(`\n${c.bold('NEXBENCH')} public-dev catalog — ${c.cyan(String(PUBLIC_SPLIT))} public specs of ${c.cyan(String(TOTAL_TASKS))} total tasks\n`);
    process.stdout.write(`${c.green(String(PUBLIC_RUNNABLE_TASKS))} runnable-local · ${c.gray(String(PUBLIC_METADATA_ONLY_TASKS))} metadata-only (reference environment required)\n`);
    process.stdout.write(c.gray('the remaining tasks are held out and rotate quarterly\n\n'));
    for (const category of categories) {
        const rows = filtered.filter((t) => t.category === category.id);
        if (!rows.length)
            continue;
        process.stdout.write(`${c.bold(category.code)} ${c.dim(category.label)}\n`);
        for (const t of rows) {
            const run = t.availability === 'runnable-local'
                ? c.green('runnable-local')
                : c.gray('metadata-only');
            process.stdout.write(`  ${pad(t.id, 12)} ${pad(t.difficulty, 8)} ${run}  ${t.title}\n`);
        }
        process.stdout.write('\n');
    }
    const filteredRunnable = filtered.filter((task) => task.availability === 'runnable-local').length;
    const filteredMetadata = filtered.length - filteredRunnable;
    process.stdout.write(c.dim(`${filteredRunnable} runnable-local; ${filteredMetadata} metadata-only in this view. Only runnable-local tasks execute under \`nexbench run\`.\n`));
    process.stdout.write(c.dim('The full 214-task suite runs against the reference environment pack — see docs/environments.md.\n'));
}
function categoryById(id) {
    return categories.find((cc) => cc.id === id);
}
