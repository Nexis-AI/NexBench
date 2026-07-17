/**
 * Resolve an agent from a `--agent` spec: a built-in name, a JS module path, an
 * HTTP endpoint, or an `agent.yaml` config. The YAML reader is a tiny, flat
 * key/value parser (no dependency) — enough for the handful of scalar keys the
 * harness needs (`adapter`, `endpoint`, `id`, `model`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exampleAgent } from '../agents/example-agent.js';
import { scriptedBaseline } from '../agents/scripted-baseline.js';
import { fail } from './util.js';
/** Parse the flat scalar keys of an agent.yaml. Ignores lists, comments, nesting. */
export function parseAgentYaml(text) {
    const cfg = {};
    for (const raw of text.split('\n')) {
        const line = raw.replace(/#.*$/, '').trim();
        const m = /^([A-Za-z_][\w-]*):\s*(.+)$/.exec(line);
        if (!m)
            continue;
        const key = m[1];
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
            val = val.slice(1, -1);
        if (key === 'id' || key === 'model' || key === 'adapter' || key === 'endpoint')
            cfg[key] = val;
    }
    return cfg;
}
/** Wrap an HTTP `/step` endpoint as an agent (language-agnostic adapters). */
export function endpointAgent(url) {
    return async (obs) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(obs),
        });
        if (!res.ok)
            throw new Error(`endpoint ${url} returned ${res.status}`);
        return (await res.json());
    };
}
async function importAgent(modPath, label) {
    const url = isAbsolute(modPath) ? pathToFileURL(modPath).href : pathToFileURL(resolve(modPath)).href;
    const mod = (await import(url));
    if (!mod.default)
        fail(`agent module ${label} has no default export`);
    return mod.default;
}
/**
 * Resolve `--agent <spec>` to an agent and a display label:
 *   scripted | example        → built-in reference agents
 *   http(s)://…               → HTTP endpoint adapter
 *   *.yaml | *.yml            → agent.yaml (reads `adapter:` or `endpoint:`)
 *   *.js | *.mjs (a path)     → a module with a default StepFn/Agent export
 */
export async function resolveAgent(spec) {
    if (spec === 'scripted' || spec === 'baseline')
        return { agent: scriptedBaseline, label: 'scripted-baseline' };
    if (spec === 'example')
        return { agent: exampleAgent, label: 'example-agent' };
    if (/^https?:\/\//.test(spec))
        return { agent: endpointAgent(spec), label: `endpoint:${spec}` };
    if (/\.ya?ml$/.test(spec)) {
        if (!existsSync(spec))
            fail(`agent config not found: ${spec}`);
        const cfg = parseAgentYaml(readFileSync(spec, 'utf8'));
        const label = cfg.id ?? spec;
        if (cfg.endpoint)
            return { agent: endpointAgent(cfg.endpoint), label: `${label} (${cfg.endpoint})` };
        if (!cfg.adapter)
            fail(`${spec}: needs an \`adapter:\` path or an \`endpoint:\` URL`);
        let adapterPath = resolve(dirname(spec), cfg.adapter);
        if (/\.ts$/.test(adapterPath)) {
            const js = adapterPath.replace(/\.ts$/, '.js');
            if (!existsSync(js))
                fail(`${cfg.adapter} is TypeScript — compile it to .js first (e.g. \`npx tsc ${cfg.adapter} --module nodenext\`)`);
            adapterPath = js;
        }
        return { agent: await importAgent(adapterPath, cfg.adapter), label };
    }
    // Otherwise treat as a path to a JS/MJS module with a default export.
    return { agent: await importAgent(spec, spec), label: spec };
}
