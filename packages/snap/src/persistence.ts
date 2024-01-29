import {
  PrefixedPersistence,
  type Persistence,
  type XmtpEnv,
} from '@xmtp/xmtp-js';
import storage from './storage';
import { buildKey } from './keys';

const ENCODING = 'binary';

// Wraps the snap storage in an interface compatible with the XMTP persistence interface
// Main difference is that XMTP persistence assumes all values are Uint8Arrays
// and expects implementations to handle serialization
export default class SnapPersistence implements Persistence {
  // eslint-disable-next-line class-methods-use-this
  async getItem(key: string): Promise<Uint8Array | null> {
    const value = await storage.getItem(key);
    if (typeof value !== 'string') {
      return null;
    }
    return value ? Uint8Array.from(Buffer.from(value, ENCODING)) : null;
  }

  // eslint-disable-next-line class-methods-use-this
  async setItem(key: string, value: Uint8Array): Promise<void> {
    await storage.setItem(key, Buffer.from(value).toString(ENCODING));
  }
}

// Create a prefixed version of the snap persistence.
export function getPersistence(address: string, env: XmtpEnv) {
  return new PrefixedPersistence(
    `xmtp/${buildKey(address, env)}/`,
    new SnapPersistence(),
  );
}
