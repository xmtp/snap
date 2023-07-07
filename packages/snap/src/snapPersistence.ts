import type { Persistence } from '@xmtp/xmtp-js';
import storage from './storage';

const ENCODING = 'binary';

// Wraps the snap storage in an interface compatible with the XMTP persistence interface
export default class SnapPersistence implements Persistence {
  async getItem(key: string): Promise<Uint8Array | null> {
    const value = await storage.getItem(key);
    if (typeof value !== 'string') {
      return null;
    }
    return value ? Uint8Array.from(Buffer.from(value, ENCODING)) : null;
  }

  async setItem(key: string, value: Uint8Array): Promise<void> {
    await storage.setItem(key, Buffer.from(value).toString(ENCODING));
  }
}
