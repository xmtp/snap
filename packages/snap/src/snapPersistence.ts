import type { Persistence } from '@xmtp/xmtp-js/browser/bundler';

import storage from './storage';

const ENCODING = 'binary';

// Wraps the snap storage in an interface compatible with the XMTP persistence interface
// Main difference is that XMTP persistence assumes all values are Uint8Arrays
// and expects implementations to handle serialization
export default class SnapPersistence implements Persistence {
  async getItem(key: string): Promise<Uint8Array | null> {
    const value = await storage.getItem(key);
    if (typeof value !== 'string') {
      return null;
    }
    // eslint-disable-next-line no-restricted-globals
    return value ? Uint8Array.from(Buffer.from(value, ENCODING)) : null;
  }

  async setItem(key: string, value: Uint8Array): Promise<void> {
    // eslint-disable-next-line no-restricted-globals
    await storage.setItem(key, Buffer.from(value).toString(ENCODING));
  }
}
