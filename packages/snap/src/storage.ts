import { Json } from '@metamask/snaps-types';
import { Mutex } from 'async-mutex';

export type StorageProvider = {
  getItem(key: string): Promise<Json>;
  setItem(key: string, value: Json): Promise<void>;
};

class SnapStorage implements StorageProvider {
  mutex = new Mutex();

  async getItem(key: string): Promise<Json> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    });

    if (!state) {
      return null;
    }

    return state[key] ?? null;
  }

  async setItem(key: string, value: Json): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const state = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });

      await snap.request({
        method: 'snap_manageState',
        params: {
          operation: 'update',
          newState: { ...state, [key]: value },
        },
      });
    });
  }
}

const storage = new SnapStorage();

export default storage;
