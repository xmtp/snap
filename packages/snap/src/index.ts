/* eslint-disable jsdoc/require-jsdoc */
import './polyfills'; // eslint-disable-line import/no-unassigned-import
import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { getHandler, isSnapRequest } from './utils';
import { type XmtpEnv } from '@xmtp/xmtp-js';
import { initKeystore, getKeystoreStatus } from './handlers';

export type SnapMeta = {
  walletAddress: string;
  env: XmtpEnv;
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request: { params, method },
}) => {
  console.log(`Got a request from ${origin} for ${method}`);
  // Validate that the request has the expected fields, which are set on all requests from `xmtp-js`
  if (!isSnapRequest(params)) {
    throw new Error('not a valid snap request');
  }

  // Unauthenticated methods:
  if (method === 'initKeystore') {
    return initKeystore(params);
  }

  if (method === 'getKeystoreStatus') {
    return getKeystoreStatus(params);
  }

  // Authenticated methods
  const { meta } = params;

  // Authenticated methods
  const handler = await getHandler(meta.walletAddress, meta.env);
  if (method in handler) {
    return handler[method as keyof typeof handler](params);
  }
  throw new Error('Invalid method');
};
