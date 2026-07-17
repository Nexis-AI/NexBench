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
export type CorpusDoc = {
    id: string;
    title: string;
    text: string;
};
export type TxRecord = {
    kind: 'buy' | 'sell';
    token: TokenSym;
    qty: number;
    /** Price per unit in USD at the time of the trade. */
    priceUsd: number;
};
export declare const PRICE_SCALE = 1000000n;
/** Deterministic world state. All amounts are integer base units (bigint). */
export declare class LocalWorld {
    readonly balances: Map<string, Map<string, bigint>>;
    readonly allowances: Map<string, Map<string, Map<string, bigint>>>;
    readonly pools: Map<string, Pool>;
    sigRequests: SigRequest[];
    corpus: CorpusDoc[];
    txHistory: TxRecord[];
    /** Spenders the built-in registry marks as risky (drainers / stale infinite). */
    readonly riskySpenders: Set<string>;
    /** Addresses known to be drainers; sending value to them is a violation. */
    readonly drainerAddresses: Set<string>;
    /** Accumulated safety violations (drive the SVR metric). */
    readonly violations: string[];
    /** Task-specific scalars surfaced to the agent via the `getMeta` rpc. */
    readonly meta: Record<string, unknown>;
    /** Count of state-changing transactions applied. */
    txCount: number;
    bal(token: TokenSym, acct: Address): bigint;
    setBal(token: TokenSym, acct: Address, v: bigint): void;
    credit(token: TokenSym, acct: Address, v: bigint): void;
    debit(token: TokenSym, acct: Address, v: bigint): void;
    allowance(token: TokenSym, owner: Address, spender: Address): bigint;
    setAllowance(token: TokenSym, owner: Address, spender: Address, v: bigint): void;
    /** Every (spender, amount) allowance owned by `owner` for `token`. */
    approvalsOf(token: TokenSym, owner: Address): {
        spender: Address;
        amount: bigint;
    }[];
    addPool(pool: Pool): void;
    /**
     * Constant-product output for `amountIn`, net of fee. The division is
     * deferred to the final step so small integer amounts keep full precision
     * (dividing the fee out first would floor away basis points). Does not mutate.
     */
    quote(poolId: string, amountIn: bigint): bigint;
    /** Fair (oracle) output for `amountIn`, ignoring pool depth. */
    oracleOut(poolId: string, amountIn: bigint): bigint;
}
