/** `nexbench submit <manifest.json>` — validate locally, then POST to intake. */
import { type Args } from '../util.js';
export declare function submitCmd(args: Args): Promise<void>;
/** Digest the exact uploaded bytes; formatting is intentionally significant. */
export declare function uploadBytesDigest(bytes: Uint8Array): string;
/** Replace a `/submissions` endpoint with its sibling durable evidence store. */
export declare function evidenceEndpointFor(submissionEndpoint: string): string;
