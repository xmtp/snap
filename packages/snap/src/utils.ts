/* eslint-disable jsdoc/require-jsdoc */
import {
  Client,
  InMemoryKeystore,
  Persistence,
  PrefixedPersistence,
  PrivateKeyBundleV1,
} from '@xmtp/xmtp-js';
import { privateKey } from '@xmtp/proto';
import SnapHandler from './handler';
import SnapPersistence from './persistence';
import type { SnapRequest } from './handler';

let _handler: ReturnType<typeof SnapHandler> | undefined;

type XmtpEnv = 'local' | 'dev' | 'production';

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
  if (!_handler) {
    const persistence = getPersistence(address, env);
    const keys = await getKeys(persistence);
    const keyStore = await InMemoryKeystore.create(keys, persistence);
    // eslint-disable-next-line require-atomic-updates
    _handler = SnapHandler(keyStore);
  }
  return _handler;
}

export function getPersistence(address: string, env: XmtpEnv) {
  return new PrefixedPersistence(
    `xmtp/${env}/${address}/`,
    new SnapPersistence(),
  );
}

export function setHandler(keystore: InMemoryKeystore) {
  _handler = SnapHandler(keystore);
}

export function getSigner() {
  return {
    getAddress: async () => {
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      return accounts[0];
    },
    signMessage: async (message: ArrayLike<number> | string) => {
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const firstAccount = accounts[0];
      return ethereum.request({
        method: 'personal_sign',
        params: [message, firstAccount],
      }) as Promise<string>;
    },
  };
}

export async function bootstrapKeystore(env: XmtpEnv) {
  const signer = getSigner();
  const client = await Client.create(signer, { env });
  const keys = new PrivateKeyBundleV1(
    await client.keystore.getPrivateKeyBundle(),
  );
  const persistence = getPersistence(client.address, env);
  await setKeys(persistence, keys);
  return InMemoryKeystore.create(keys, persistence);
}

export function isSnapRequest(params: any): params is SnapRequest {
  return Boolean(params) && params.req !== undefined;
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
