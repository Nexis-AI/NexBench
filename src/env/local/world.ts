/**
 * A deterministic, in-memory world used by the bundled public-dev environment.
 * It is intentionally small — an integer token ledger, constant-product pools
 * with a frozen oracle mid, a signature-request inbox, a frozen corpus, and an
 * indexed transaction history. It is NOT an EVM: it is the minimal state
 * machine needed to make the public-split tasks genuinely executable and
 * programmatically checkable offline.
 *
 * The full 214-task suite runs against pinned mainnet forks in the reference
 * environment pack (see docs/environments.md); the interface an agent sees is
 * identical, so an adapter that runs here runs there.
 */

export type Address = string;
export type TokenSym = string;

export type Pool = {
  id: string;
  tokenIn: TokenSym;
  tokenOut: TokenSym;
  reserveIn: bigint;
  reserveOut: bigint;
  /** Fee in basis points (e.g. 30 = 0.30%). */
  feeBps: number;
  /**
   * Oracle-fair price: units of tokenOut per 1 unit of tokenIn, scaled by
   * PRICE_SCALE. Frozen at fork time; best-execution is graded against it.
   */
  oracleMid: bigint;
};

export type SigRequest = {
  id: string;
  /** Human-readable summary the agent classifies. */
  summary: string;
  /** Ground-truth label used by the checker (never surfaced to the agent). */
  malicious: boolean;
};

export type CorpusDoc = { id: string; title: string; text: string };

export type TxRecord = {
  kind: 'buy' | 'sell';
  token: TokenSym;
  qty: number;
  /** Price per unit in USD at the time of the trade. */
  priceUsd: number;
};

export const PRICE_SCALE = 1_000_000n; // 6 decimals of price precision

/** Deterministic world state. All amounts are integer base units (bigint). */
export class LocalWorld {
  readonly balances = new Map<TokenSym, Map<Address, bigint>>();
  readonly allowances = new Map<TokenSym, Map<Address, Map<Address, bigint>>>();
  readonly pools = new Map<string, Pool>();
  sigRequests: SigRequest[] = [];
  corpus: CorpusDoc[] = [];
  txHistory: TxRecord[] = [];
  /** Spenders the built-in registry marks as risky (drainers / stale infinite). */
  readonly riskySpenders = new Set<Address>();
  /** Addresses known to be drainers; sending value to them is a violation. */
  readonly drainerAddresses = new Set<Address>();
  /** Accumulated safety violations (drive the SVR metric). */
  readonly violations: string[] = [];
  /** Task-specific scalars surfaced to the agent via the `getMeta` rpc. */
  readonly meta: Record<string, unknown> = {};
  /** Count of state-changing transactions applied. */
  txCount = 0;

  /* ————— balances ————— */

  bal(token: TokenSym, acct: Address): bigint {
    return this.balances.get(token)?.get(acct) ?? 0n;
  }
  setBal(token: TokenSym, acct: Address, v: bigint): void {
    const m = this.balances.get(token) ?? new Map<Address, bigint>();
    m.set(acct, v);
    this.balances.set(token, m);
  }
  credit(token: TokenSym, acct: Address, v: bigint): void {
    this.setBal(token, acct, this.bal(token, acct) + v);
  }
  debit(token: TokenSym, acct: Address, v: bigint): void {
    const cur = this.bal(token, acct);
    if (cur < v) throw new Error(`insufficient ${token}: have ${cur}, need ${v}`);
    this.setBal(token, acct, cur - v);
  }

  /* ————— allowances ————— */

  allowance(token: TokenSym, owner: Address, spender: Address): bigint {
    return this.allowances.get(token)?.get(owner)?.get(spender) ?? 0n;
  }
  setAllowance(token: TokenSym, owner: Address, spender: Address, v: bigint): void {
    const byOwner = this.allowances.get(token) ?? new Map<Address, Map<Address, bigint>>();
    const bySpender = byOwner.get(owner) ?? new Map<Address, bigint>();
    bySpender.set(spender, v);
    byOwner.set(owner, bySpender);
    this.allowances.set(token, byOwner);
  }
  /** Every (spender, amount) allowance owned by `owner` for `token`. */
  approvalsOf(token: TokenSym, owner: Address): { spender: Address; amount: bigint }[] {
    const bySpender = this.allowances.get(token)?.get(owner);
    if (!bySpender) return [];
    return [...bySpender.entries()].map(([spender, amount]) => ({ spender, amount }));
  }

  /* ————— pools ————— */

  addPool(pool: Pool): void {
    this.pools.set(pool.id, pool);
  }
  /**
   * Constant-product output for `amountIn`, net of fee. The division is
   * deferred to the final step so small integer amounts keep full precision
   * (dividing the fee out first would floor away basis points). Does not mutate.
   */
  quote(poolId: string, amountIn: bigint): bigint {
    const p = this.pools.get(poolId);
    if (!p) throw new Error(`unknown pool ${poolId}`);
    const inAfterFee = amountIn * BigInt(10_000 - p.feeBps); // scaled by 1e4
    return (inAfterFee * p.reserveOut) / (p.reserveIn * 10_000n + inAfterFee);
  }
  /** Fair (oracle) output for `amountIn`, ignoring pool depth. */
  oracleOut(poolId: string, amountIn: bigint): bigint {
    const p = this.pools.get(poolId);
    if (!p) throw new Error(`unknown pool ${poolId}`);
    return (amountIn * p.oracleMid) / PRICE_SCALE;
  }
}
