/**
 * Example NEXBENCH adapter (TypeScript).
 *
 * An agent is a step function; the harness drives the loop. This one uses fixed
 * heuristics (no model calls) to solve several runnable public-dev tasks, so it
 * runs offline and deterministically. Swap the bodies for your own model calls.
 *
 *   npx tsc adapter.ts --module nodenext --moduleResolution nodenext
 *   nexbench run --agent ./adapter.js
 *
 * The object form ({ reset, step }) gives per-trial memory that the harness
 * clears before each of the five trials.
 */

import type { Action, Agent, Json, Observation } from 'nexbench';

function arr(obs: Observation): Json[] {
  return Array.isArray(obs.last?.data) ? (obs.last!.data as Json[]) : [];
}

const adapter: Agent = {
  // Per-trial state lives here; reset() runs before every trial.
  // (declared via closure below)
  reset() {
    revokeQueue = [];
    quotes = {};
  },

  step(obs: Observation): Action {
    switch (obs.task.id) {
      // Approval audit — read allowances, revoke the risky ones, submit.
      case 'NB-SEC-013': {
        if (obs.step === 0) return { type: 'rpc_call', method: 'listApprovals', params: { token: 'USDC' } };
        if (obs.step === 1) {
          revokeQueue = (arr(obs) as { spender: string; risky: boolean }[])
            .filter((r) => r.risky)
            .map((r) => r.spender);
        }
        const next = revokeQueue.shift();
        return next
          ? { type: 'sign_request', intent: { kind: 'revoke', token: 'USDC', spender: next } }
          : { type: 'submit' };
      }

      // Batched payout — one transaction for all payees.
      case 'NB-EXE-004': {
        if (obs.step === 0) return { type: 'rpc_call', method: 'getPayees' };
        if (obs.step === 1) {
          const payees = arr(obs) as { to: string; amount: string }[];
          return { type: 'sign_request', intent: { kind: 'safe_batch_transfer', token: 'USDC', payees } };
        }
        return { type: 'submit' };
      }

      // Best execution — compare venues, swap through the better quote.
      case 'NB-SWP-003': {
        if (obs.step === 0) return { type: 'rpc_call', method: 'quote', params: { pool: 'eth-usdc-deep', amountIn: '25' } };
        if (obs.step === 1) {
          quotes['eth-usdc-deep'] = BigInt(String((obs.last?.data as { amountOut?: string })?.amountOut ?? '0'));
          return { type: 'rpc_call', method: 'quote', params: { pool: 'eth-usdc-shallow', amountIn: '25' } };
        }
        if (obs.step === 2) {
          quotes['eth-usdc-shallow'] = BigInt(String((obs.last?.data as { amountOut?: string })?.amountOut ?? '0'));
          const [best] = Object.entries(quotes).sort((a, b) => (b[1] > a[1] ? 1 : -1));
          return {
            type: 'sign_request',
            intent: { kind: 'swap', pool: best?.[0] ?? 'eth-usdc-deep', tokenIn: 'ETH', amountIn: '25', minOut: String(best?.[1] ?? 0n) },
          };
        }
        return { type: 'submit' };
      }

      default:
        return { type: 'submit' };
    }
  },
};

let revokeQueue: string[] = [];
let quotes: Record<string, bigint> = {};

export default adapter;
