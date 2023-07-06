import { Wallet } from 'ethers';
import { SnapMeta } from '.';

export function newWallet() {
  return Wallet.createRandom();
}

export function buildRpcRequest(method: string, req: string, meta: SnapMeta) {
  return {
    origin: 'http://localhost:3000',
    method: method,
    params: { req, meta },
  };
}
