/* eslint-disable jsdoc/require-jsdoc */
import { XmtpEnv } from '@xmtp/xmtp-js';
import { AUTHORIZATION_EXPIRY_MS } from './config';
import storage from './storage';

type AuthRecord = {
  isAuthorized: boolean;
  authorizedAt: Date;
};

type StoredAuthRecord = {
  isAuthorized: boolean;
  authorizedAt: string;
};

/**
 * The Authorizer singleton class wraps the Snap storage to persist user authorization
 * preferences. Users must consent to allowing the Snap to access their
 * keys for each combination of origin/walletAddress/environment.
 *
 * Today, authorization is boolean. We may decide to add more granular
 * permissions at a later time.
 *
 * Authorization is irrevocable at this time
 */
export class Authorizer {
  expiryMs: number;

  constructor(expiryMs: number = AUTHORIZATION_EXPIRY_MS) {
    this.expiryMs = expiryMs;
  }

  private async getAuthRecord(
    walletAddress: string,
    env: XmtpEnv,
    origin: string,
  ) {
    const key = buildKey(walletAddress, env, origin);
    const authData = await storage.getItem(key);
    if (!isStoredAuthRecord(authData)) {
      return null;
    }

    return toAuthRecord(authData);
  }

  async isAuthorized(
    walletAddress: string,
    env: XmtpEnv,
    origin: string,
  ): Promise<boolean> {
    const authRecord = await this.getAuthRecord(walletAddress, env, origin);
    if (!authRecord?.isAuthorized) {
      return false;
    }
    const isExpired =
      authRecord.authorizedAt.getTime() + this.expiryMs < Date.now();
    return !isExpired;
  }

  async authorize(walletAddress: string, env: XmtpEnv, origin: string) {
    const key = buildKey(walletAddress, env, origin);
    const authRecord: StoredAuthRecord = {
      isAuthorized: true,
      authorizedAt: new Date().toISOString(),
    };

    await storage.setItem(key, authRecord);
  }
}

// Build the storage key for a given wallet address, environment, and origin.
function buildKey(walletAddress: string, env: XmtpEnv, origin: string) {
  return `authz/${walletAddress}/${env}/${origin}`;
}

function isStoredAuthRecord(value: any): value is StoredAuthRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isAuthorized' in value &&
    'authorizedAt' in value &&
    typeof value.isAuthorized === 'boolean' &&
    typeof value.authorizedAt === 'string'
  );
}

function toAuthRecord(record: StoredAuthRecord): AuthRecord {
  return {
    isAuthorized: record.isAuthorized,
    authorizedAt: new Date(record.authorizedAt),
  };
}

const authorizer = new Authorizer();

export default authorizer;
