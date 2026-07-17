/**
 * The scripted baseline: a hand-written, deterministic policy that solves every
 * runnable public-dev task with fixed heuristics and no model calls. It is the
 * `scripted-baseline` reference on the leaderboard — the floor a learned agent
 * must clear — and doubles as a solvability smoke test: if the baseline stops
 * passing a task, the task or the world regressed.
 */
import { computePnl, parseKvFacts } from '../env/local/tasks.js';
function dataObj(obs) {
    const d = obs.last?.data;
    return d && typeof d === 'object' && !Array.isArray(d) ? d : undefined;
}
function dataArr(obs) {
    const d = obs.last?.data;
    return Array.isArray(d) ? d : undefined;
}
export class ScriptedBaseline {
    mem = { toRevoke: [], quotes: {} };
    reset() {
        this.mem = { toRevoke: [], quotes: {} };
    }
    step(obs) {
        switch (obs.task.id) {
            case 'NB-EXE-004':
                return this.exe004(obs);
            case 'NB-SEC-013':
                return this.sec013(obs);
            case 'NB-SWP-003':
                return this.swp003(obs);
            case 'NB-SEC-006':
                return this.sec006(obs);
            case 'NB-RES-001':
                return this.res001(obs);
            case 'NB-ANL-003':
                return this.anl003(obs);
            default:
                return { type: 'submit' };
        }
    }
    /** Read payees, pay them all in a single batch transfer, submit. */
    exe004(obs) {
        if (obs.step === 0)
            return { type: 'rpc_call', method: 'getPayees' };
        if (obs.step === 1) {
            const payees = (dataArr(obs) ?? []);
            return { type: 'sign_request', intent: { kind: 'safe_batch_transfer', token: 'USDC', payees } };
        }
        return { type: 'submit' };
    }
    /** List allowances, queue the risky ones, revoke them one per step, submit. */
    sec013(obs) {
        if (obs.step === 0)
            return { type: 'rpc_call', method: 'listApprovals', params: { token: 'USDC' } };
        if (obs.step === 1) {
            const rows = (dataArr(obs) ?? []);
            this.mem.toRevoke = rows.filter((r) => r.risky).map((r) => r.spender);
        }
        const next = this.mem.toRevoke.shift();
        if (next)
            return { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: next } };
        return { type: 'submit' };
    }
    /** Quote both venues, then swap through whichever returns more. */
    swp003(obs) {
        if (obs.step === 0)
            return { type: 'rpc_call', method: 'quote', params: { pool: 'eth-usdc-deep', amountIn: '25' } };
        if (obs.step === 1) {
            this.mem.quotes['eth-usdc-deep'] = BigInt(String(dataObj(obs)?.amountOut ?? '0'));
            return { type: 'rpc_call', method: 'quote', params: { pool: 'eth-usdc-shallow', amountIn: '25' } };
        }
        if (obs.step === 2) {
            this.mem.quotes['eth-usdc-shallow'] = BigInt(String(dataObj(obs)?.amountOut ?? '0'));
            const [best] = Object.entries(this.mem.quotes).sort((a, b) => (b[1] > a[1] ? 1 : -1));
            const pool = best?.[0] ?? 'eth-usdc-deep';
            const minOut = (best?.[1] ?? 0n).toString();
            return { type: 'sign_request', intent: { kind: 'swap', pool, tokenIn: 'ETH', amountIn: '25', minOut } };
        }
        return { type: 'submit' };
    }
    /** Classify signature requests with a keyword drainer heuristic. */
    sec006(obs) {
        if (obs.step === 0)
            return { type: 'rpc_call', method: 'getSigRequests' };
        const sigs = (dataArr(obs) ?? []);
        const labels = {};
        for (const s of sigs)
            labels[s.id] = isMalicious(s.summary) ? 'malicious' : 'benign';
        return { type: 'submit', answer: { labels } };
    }
    /** Query the corpus, parse key:value facts, submit them. */
    res001(obs) {
        if (obs.step === 0)
            return { type: 'corpus_query', query: 'supply mint authority audits listings team locked' };
        const docs = (dataArr(obs) ?? []);
        const seen = new Set();
        const facts = [];
        for (const doc of docs) {
            for (const f of parseKvFacts(doc.text ?? '')) {
                const k = `${f.key}=${f.value}`;
                if (!seen.has(k)) {
                    seen.add(k);
                    facts.push(f);
                }
            }
        }
        return { type: 'submit', answer: { facts } };
    }
    /** Pull trades + mark price, run FIFO accounting, submit realized/unrealized. */
    anl003(obs) {
        if (obs.step === 0)
            return { type: 'rpc_call', method: 'getTxHistory' };
        if (obs.step === 1) {
            this.mem.trades = (dataArr(obs) ?? []);
            return { type: 'rpc_call', method: 'getMeta', params: { key: 'markPriceUsd' } };
        }
        const mark = Number(obs.last?.data ?? 0);
        const pnl = computePnl(this.mem.trades ?? [], mark);
        return { type: 'submit', answer: { realized: pnl.realized, unrealized: pnl.unrealized } };
    }
}
/** Keyword drainer heuristic — flags the classic malicious-signature patterns. */
export function isMalicious(summary) {
    return /setapprovalforall|unlimited|max uint|bulk order transfer|drainer|entire .*balance|phishing/i.test(summary);
}
export const scriptedBaseline = new ScriptedBaseline();
export default scriptedBaseline;
