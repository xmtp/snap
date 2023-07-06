import type { Persistence } from '@xmtp/xmtp-js';

const ENCODING = 'binary';

type SnapState = { [k: string]: any } | null | undefined;

export default class SnapPersistence implements Persistence {
  async getItem(key: string): Promise<Uint8Array | null> {
    const state: SnapState = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    });

    if (!state) {
      return null;
    }

    const value = state[key];
    return value ? Uint8Array.from(Buffer.from(value, ENCODING)) : null;
  }

  async setItem(key: string, value: Uint8Array): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: { [key]: Buffer.from(value).toString(ENCODING) },
      },
    });
  }
}
