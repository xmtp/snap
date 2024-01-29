import type { Persistence, XmtpEnv } from '@xmtp/xmtp-js';
import { PrivateKeyBundleV1 } from '@xmtp/xmtp-js';
import { privateKey } from '@xmtp/proto';
import { KeyNotFoundError } from './errors';

// Joins the address and env with a slash
export function buildKey(address: string, env: XmtpEnv) {
  return `${address}/${env}`;
}

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
