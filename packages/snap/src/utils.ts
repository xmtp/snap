/* eslint-disable jsdoc/require-jsdoc */
import { privateKey, fetcher } from '@xmtp/proto';
import {
  InMemoryKeystore,
  PrefixedPersistence,
  PrivateKeyBundleV1,
} from '@xmtp/xmtp-js/browser/bundler';
import type { XmtpEnv, Persistence } from '@xmtp/xmtp-js/browser/bundler';

import { KeyNotFoundError } from './errors';
import { type SnapRequest, keystoreHandler } from './handlers';
import SnapPersistence from './snapPersistence';

const { b64Encode, b64Decode } = fetcher;

// Mapping of keystore identifiers ($walletAddress/$env) to handlers
const handlers = new Map<string, ReturnType<typeof keystoreHandler>>();

// Gets the keys from provided persistence and converts to a class
export async function getKeys(persistence: Persistence) {
  const keys = await persistence.getItem(`keys`);
  if (!keys) {
    throw new KeyNotFoundError('no keys found for client');
  }

  const bundle = privateKey.PrivateKeyBundle.decode(keys).v1;
  if (!bundle) {
    throw new Error('Bundle cannot be processed');
  }

  return new PrivateKeyBundleV1(bundle);
}

// Store the keys in the provided persistence
export async function setKeys(
  persistence: Persistence,
  keys: PrivateKeyBundleV1,
) {
  return persistence.setItem(`keys`, keys.encode());
}

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

// Create a prefixed version of the snap persistence.
export function getPersistence(address: string, env: XmtpEnv) {
  return new PrefixedPersistence(
    `xmtp/${buildKey(address, env)}/`,
    new SnapPersistence(),
  );
}

// Validates incoming request params matches expected format
export function isSnapRequest(params: any): params is SnapRequest {
  return (
    Boolean(params) &&
    typeof params.meta === 'object' &&
    params.meta.env &&
    params.meta.walletAddress
  );
}

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

// Joins the address and env with a slash
function buildKey(address: string, env: XmtpEnv) {
  return `${address}/${env}`;
}
