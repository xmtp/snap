/* eslint-disable jsdoc/require-jsdoc */
import { Wallet } from 'ethers';
import { SnapMeta } from '.';

export function newWallet() {
  return Wallet.createRandom();
}

export function buildRpcRequest(method: string, req: string, meta: SnapMeta) {
  return {
    origin: 'http://localhost:3000',
    method,
    params: { req, meta },
  };
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
