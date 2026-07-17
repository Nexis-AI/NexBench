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
export const PRICE_SCALE = 1000000n; // 6 decimals of price precision
/** Deterministic world state. All amounts are integer base units (bigint). */
export class LocalWorld {
    balances = new Map();
    allowances = new Map();
    pools = new Map();
    sigRequests = [];
    corpus = [];
    txHistory = [];
    /** Spenders the built-in registry marks as risky (drainers / stale infinite). */
    riskySpenders = new Set();
    /** Addresses known to be drainers; sending value to them is a violation. */
    drainerAddresses = new Set();
    /** Accumulated safety violations (drive the SVR metric). */
    violations = [];
    /** Task-specific scalars surfaced to the agent via the `getMeta` rpc. */
    meta = {};
    /** Count of state-changing transactions applied. */
    txCount = 0;
    /* ————— balances ————— */
    bal(token, acct) {
        return this.balances.get(token)?.get(acct) ?? 0n;
    }
    setBal(token, acct, v) {
        const m = this.balances.get(token) ?? new Map();
        m.set(acct, v);
        this.balances.set(token, m);
    }
    credit(token, acct, v) {
        this.setBal(token, acct, this.bal(token, acct) + v);
    }
    debit(token, acct, v) {
        const cur = this.bal(token, acct);
        if (cur < v)
            throw new Error(`insufficient ${token}: have ${cur}, need ${v}`);
        this.setBal(token, acct, cur - v);
    }
    /* ————— allowances ————— */
    allowance(token, owner, spender) {
        return this.allowances.get(token)?.get(owner)?.get(spender) ?? 0n;
    }
    setAllowance(token, owner, spender, v) {
        const byOwner = this.allowances.get(token) ?? new Map();
        const bySpender = byOwner.get(owner) ?? new Map();
        bySpender.set(spender, v);
        byOwner.set(owner, bySpender);
        this.allowances.set(token, byOwner);
    }
    /** Every (spender, amount) allowance owned by `owner` for `token`. */
    approvalsOf(token, owner) {
        const bySpender = this.allowances.get(token)?.get(owner);
        if (!bySpender)
            return [];
        return [...bySpender.entries()].map(([spender, amount]) => ({ spender, amount }));
    }
    /* ————— pools ————— */
    addPool(pool) {
        this.pools.set(pool.id, pool);
    }
    /**
     * Constant-product output for `amountIn`, net of fee. The division is
     * deferred to the final step so small integer amounts keep full precision
     * (dividing the fee out first would floor away basis points). Does not mutate.
     */
    quote(poolId, amountIn) {
        const p = this.pools.get(poolId);
        if (!p)
            throw new Error(`unknown pool ${poolId}`);
        const inAfterFee = amountIn * BigInt(10_000 - p.feeBps); // scaled by 1e4
        return (inAfterFee * p.reserveOut) / (p.reserveIn * 10000n + inAfterFee);
    }
    /** Fair (oracle) output for `amountIn`, ignoring pool depth. */
    oracleOut(poolId, amountIn) {
        const p = this.pools.get(poolId);
        if (!p)
            throw new Error(`unknown pool ${poolId}`);
        return (amountIn * p.oracleMid) / PRICE_SCALE;
    }
}
