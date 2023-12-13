/* eslint-disable jsdoc/require-jsdoc */
import {
  heading,
  panel,
  text,
  type OnRpcRequestHandler,
} from '@metamask/snaps-sdk';
import { type XmtpEnv } from '@xmtp/xmtp-js';

import authorizer from './authorizer';
import { GET_KEYSTORE_STATUS_METHOD, INIT_KEYSTORE_METHOD } from './config';
import { initKeystore, getKeystoreStatus } from './handlers';
import { getHandler, isSnapRequest, prettyWalletAddress } from './utils';

export type SnapMeta = {
  walletAddress: string;
  env: XmtpEnv;
};

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request: { params, method },
}) => {
  console.log(`Got a snap request from ${origin} for ${method}`);

  // Validate that the request has the expected fields, which are set on all requests from `xmtp-js`
  if (!isSnapRequest(params)) {
    throw new Error('not a valid snap request');
  }

  const { meta } = params;

  // Unauthenticated methods:
  if (method === GET_KEYSTORE_STATUS_METHOD) {
    return getKeystoreStatus(params);
  }

  // Authenticated methods below
  if (method === INIT_KEYSTORE_METHOD) {
    // initKeystore will check to ensure that the bundle matches the wallet address provided above
    const res = await initKeystore(params);
    // If the user has uploaded a valid bundle, authorize for the origin.
    // Bundle is validated to match the wallet address and to have valid public/private keys
    await authorizer.authorize(meta.walletAddress, meta.env, origin);
    return res;
  }

  // Check if the user has authorized this origin/wallet/env combination
  if (!(await authorizer.isAuthorized(meta.walletAddress, meta.env, origin))) {
    // If not, prompt for authorization
    await allowAuthorization(meta.walletAddress, meta.env, origin);
  }

  // Authenticated methods
  const handler = await getHandler(meta.walletAddress, meta.env);
  if (method in handler) {
    return handler[method as keyof typeof handler](params);
  }

  // If the supplied method does not have a matching handler, throw an error
  throw new Error('invalid method');
};

async function allowAuthorization(
  walletAddress: string,
  env: XmtpEnv,
  origin: string,
) {
  const promptSuccess = await permissionPrompt(walletAddress, origin);
  if (promptSuccess) {
    await authorizer.authorize(walletAddress, env, origin);
  } else {
    throw new Error('user permission prompt rejected');
  }
}

async function permissionPrompt(
  walletAddress: string,
  origin: string,
): Promise<boolean> {
  const result = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading('XMTP Permission Request'),
        text(
          `${origin} is requesting permission to access your XMTP account.
          This will allow the application to send and receive XMTP messages for the wallet ${prettyWalletAddress(
            walletAddress,
          )} on your behalf.`,
        ),
      ]),
    },
  });

  if (typeof result !== 'boolean') {
    throw new Error('Invalid response from permission prompt');
  }

  return result;
}
