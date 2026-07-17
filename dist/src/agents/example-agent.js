/**
 * A deliberately partial reference agent. It clears the easy tasks, is
 * unreliable on best-execution and drainer triage, and gets PnL accounting
 * wrong — so a public-dev run shows a realistic spread and, importantly,
 * pass^5 well below pass@1. Use it as the template to beat, and read it
 * alongside the scripted baseline to see what "solved" looks like.
 */
import { hashSeed, mulberry32 } from '../harness/rng.js';
function dataArr(obs) {
    const d = obs.last?.data;
    return Array.isArray(d) ? d : undefined;
}
export class ExampleAgent {
    rand = Math.random;
    reset(taskId, trial) {
        this.rand = mulberry32(hashSeed(taskId, trial));
    }
    step(obs) {
        switch (obs.task.id) {
            case 'NB-EXE-004':
                if (obs.step === 0)
                    return { type: 'rpc_call', method: 'getPayees' };
                if (obs.step === 1) {
                    const payees = (dataArr(obs) ?? []);
                    return { type: 'sign_request', intent: { kind: 'safe_batch_transfer', token: 'USDC', payees } };
                }
                return { type: 'submit' };
            case 'NB-SEC-013':
                if (obs.step === 0)
                    return { type: 'rpc_call', method: 'listApprovals', params: { token: 'USDC' } };
                if (obs.step === 1) {
                    const rows = (dataArr(obs) ?? []);
                    const risky = rows.filter((r) => r.risky);
                    if (risky[0])
                        return { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: risky[0].spender } };
                }
                if (obs.step === 2) {
                    // Revoke the second risky spender too (there are exactly two).
                    return { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: '0xdrainer00000000000000000000000000000bad' } };
                }
                return { type: 'submit' };
            case 'NB-SWP-003': {
                // Picks a venue by coin flip — no quote comparison. ~60% land the deep pool.
                if (obs.step === 0) {
                    const pool = this.rand() < 0.6 ? 'eth-usdc-deep' : 'eth-usdc-shallow';
                    return { type: 'sign_request', intent: { kind: 'swap', pool, tokenIn: 'ETH', amountIn: '25', minOut: '0' } };
                }
                return { type: 'submit' };
            }
            case 'NB-SEC-006': {
                if (obs.step === 0)
                    return { type: 'rpc_call', method: 'getSigRequests' };
                const sigs = (dataArr(obs) ?? []);
                const labels = {};
                for (const s of sigs) {
                    // Weak heuristic: misses "drain entire balance" phrasing about half the time.
                    const hit = /setapprovalforall|unlimited|max uint|bulk order transfer/i.test(s.summary);
                    const softHit = /drainer|entire .*balance|phishing/i.test(s.summary) && this.rand() < 0.5;
                    labels[s.id] = hit || softHit ? 'malicious' : 'benign';
                }
                return { type: 'submit', answer: { labels } };
            }
            case 'NB-RES-001':
                if (obs.step === 0)
                    return { type: 'corpus_query', query: 'supply mint authority audits listings team locked' };
                {
                    const docs = (dataArr(obs) ?? []);
                    const facts = [];
                    for (const doc of docs) {
                        for (const line of (doc.text ?? '').split('\n')) {
                            const idx = line.indexOf(':');
                            if (idx > 0)
                                facts.push({ key: line.slice(0, idx).trim().toLowerCase(), value: line.slice(idx + 1).trim().toLowerCase() });
                        }
                    }
                    return { type: 'submit', answer: { facts } };
                }
            case 'NB-ANL-003':
                if (obs.step === 0)
                    return { type: 'rpc_call', method: 'getTxHistory' };
                if (obs.step === 1)
                    return { type: 'rpc_call', method: 'getMeta', params: { key: 'markPriceUsd' } };
                // Wrong on purpose: reports gross proceeds, not FIFO realized PnL.
                return { type: 'submit', answer: { realized: 2620, unrealized: 630 } };
            default:
                return { type: 'submit' };
        }
    }
}
export const exampleAgent = new ExampleAgent();
export default exampleAgent;
