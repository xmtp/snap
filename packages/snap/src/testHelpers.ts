/* eslint-disable jsdoc/require-jsdoc */
import { Wallet } from 'ethers';

import type { SnapMeta } from '.';

export function newWallet() {
  return Wallet.createRandom();
}

export function buildRpcRequest(
  method: string,
  req: string | null,
  meta: SnapMeta,
) {
  const params: { req?: string; meta: SnapMeta } = req
    ? { req, meta }
    : { meta };
  return {
    origin: 'http://localhost:3000',
    method,
    params,
  };
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
