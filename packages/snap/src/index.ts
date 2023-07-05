/* eslint-disable jsdoc/require-jsdoc */
import './polyfills'; // eslint-disable-line import/no-unassigned-import
import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text, heading } from '@metamask/snaps-ui';
import { isSnapRequest } from './utils';
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
  request,
}) => {
  // Validate that the request has the expected fields, which are set on all requests from `xmtp-js`
  if (!isSnapRequest(request.params)) {
    throw new Error('not a valid snap request');
  }

  // Unauthenticated methods:
  if (request.method === 'initKeystore') {
    return initKeystore(request.params);
  }

  if (request.method === 'getKeystoreStatus') {
    return getKeystoreStatus(request.params);
  }

  // Authenticated methods
  // const handler = await getHandler();
  // if (request.method in handler && isSnapRequest(request.params)) {
  //   return handler[request.method as keyof typeof handler](request.params);
  // }
  throw new Error('Invalid method');
};
