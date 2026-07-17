/**
 * Resolve an agent from a `--agent` spec: a built-in name, a JS module path, an
 * HTTP endpoint, or an `agent.yaml` config. The YAML reader is a tiny, flat
 * key/value parser (no dependency) — enough for the handful of scalar keys the
 * harness needs (`adapter`, `endpoint`, `id`, `model`).
 */
import type { AgentLike } from '../env/types.js';
export type AgentConfig = {
    id?: string;
    model?: string;
    adapter?: string;
    endpoint?: string;
};
/** Parse the flat scalar keys of an agent.yaml. Ignores lists, comments, nesting. */
export declare function parseAgentYaml(text: string): AgentConfig;
/** Wrap an HTTP `/step` endpoint as an agent (language-agnostic adapters). */
export declare function endpointAgent(url: string): AgentLike;
/**
 * Resolve `--agent <spec>` to an agent and a display label:
 *   scripted | example        → built-in reference agents
 *   http(s)://…               → HTTP endpoint adapter
 *   *.yaml | *.yml            → agent.yaml (reads `adapter:` or `endpoint:`)
 *   *.js | *.mjs (a path)     → a module with a default StepFn/Agent export
 */
export declare function resolveAgent(spec: string): Promise<{
    agent: AgentLike;
    label: string;
}>;
