import { fetcher } from '@xmtp/proto';
import { InMemoryKeystore } from '@xmtp/xmtp-js';
import type { XmtpEnv } from '@xmtp/xmtp-js';
import { type SnapRequest, keystoreHandler } from './handlers';
import { buildKey, getKeys } from './keys';
import { getPersistence } from './persistence';

// Validates incoming request params matches expected format
export function isSnapRequest(params: any): params is SnapRequest {
  return (
    typeof params === 'object' &&
    params !== null &&
    'meta' in params &&
    typeof (params as SnapRequest).meta === 'object' &&
    (params as SnapRequest).meta !== null &&
    'env' in (params as SnapRequest).meta &&
    typeof (params as SnapRequest).meta.env === 'string' &&
    'walletAddress' in (params as SnapRequest).meta &&
    typeof (params as SnapRequest).meta.walletAddress === 'string'
  );
}

const { b64Encode, b64Decode } = fetcher;

// Returns the first 6 and last 4 characters of the address separated by ellipses
export function prettyWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Base64 encodes the provided data
export function base64Encode(data: Uint8Array) {
  return b64Encode(data, 0, data.length);
}

export function base64Decode(data: string): Uint8Array {
  return b64Decode(data);
}

// Mapping of keystore identifiers ($walletAddress/$env) to handlers
const handlers = new Map<string, ReturnType<typeof keystoreHandler>>();

// Look up the keystore handler in memory, or create a new one if it doesn't exist
export async function getHandler(address: string, env: XmtpEnv) {
  const key = buildKey(address, env);
  if (!handlers.has(key)) {
    const persistence = getPersistence(address, env);
    // This will throw if keys do not exist
    const keys = await getKeys(persistence);
    const keyStore = await InMemoryKeystore.create(keys, persistence);
    handlers.set(key, keystoreHandler(keyStore));
  }

  return handlers.get(key);
}
