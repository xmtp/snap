/* eslint-disable jsdoc/require-jsdoc */
import {
  Client,
  InMemoryKeystore,
  Persistence,
  PrefixedPersistence,
  PrivateKeyBundleV1,
} from '@xmtp/xmtp-js';
import { privateKey } from '@xmtp/proto';
import SnapHandler from './handlers';
import SnapPersistence from './persistence';
import type { SnapRequest } from './handlers';
import type { SnapMeta } from './index';
import type { XmtpEnv } from '@xmtp/xmtp-js';

// Mapping of keystore identifiers ($walletAddress/$env) to handlers
const handlers = new Map<string, ReturnType<typeof SnapHandler>>();

export async function getKeys(persistence: Persistence) {
  const keys = await persistence.getItem(`keys`);
  if (!keys) {
    throw new Error('No keys found for client');
  }
  const bundle = privateKey.PrivateKeyBundle.decode(keys).v1;
  if (!bundle) {
    throw new Error('Bundle cannot be processed');
  }
  return new PrivateKeyBundleV1(bundle);
}

export function setKeys(persistence: Persistence, keys: PrivateKeyBundleV1) {
  return persistence.setItem(`keys`, keys.encode());
}

export async function getHandler(address: string, env: XmtpEnv) {
  const key = buildKey(address, env);
  if (!handlers.has(key)) {
    console.log(`Adding handler to cache for key ${key}`);
    const persistence = getPersistence(address, env);
    const keys = await getKeys(persistence);
    const keyStore = await InMemoryKeystore.create(keys, persistence);
    handlers.set(key, SnapHandler(keyStore));
  }

  return handlers.get(key);
}

export function getPersistence(address: string, env: XmtpEnv) {
  return new PrefixedPersistence(
    `xmtp/${env}/${address}/`,
    new SnapPersistence(),
  );
}

export function isSnapRequest(params: any): params is SnapRequest {
  return (
    Boolean(params) &&
    // Expect that params.req is not undefined. BUT it may be null for certain request types
    params.req !== undefined &&
    typeof params.meta === 'object' &&
    params.meta.env &&
    params.meta.walletAddress
  );
}

export const truncate = (str: string | undefined, length: number): string => {
  if (!str) {
    return '';
  }

  if (str.length > length) {
    return `${str.substring(0, length - 3)}...`;
  }

  return str;
};

function buildKey(address: string, env: XmtpEnv) {
  return `${address}/${env}`;
}
