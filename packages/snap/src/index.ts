/* eslint-disable jsdoc/require-jsdoc */
import './polyfills'; // eslint-disable-line import/no-unassigned-import
import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { type XmtpEnv } from '@xmtp/xmtp-js';
import { heading, panel, text } from '@metamask/snaps-ui';
import { getHandler, isSnapRequest, prettyWalletAddress } from './utils';
import { initKeystore, getKeystoreStatus } from './handlers';
import authorizer from './authorizer';

export type SnapMeta = {
  walletAddress: string;
  env: XmtpEnv;
};

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request: { params, method },
}) => {
  console.log(`Got a snap request from ${origin} for ${method}`);
  if (method === 'debug') {
    return handleDebug(params as any);
  }

  // Validate that the request has the expected fields, which are set on all requests from `xmtp-js`
  if (!isSnapRequest(params)) {
    throw new Error('not a valid snap request');
  }

  const { meta } = params;

  // Unauthenticated methods:
  if (method === 'getKeystoreStatus') {
    return getKeystoreStatus(params);
  }

  // Authenticated methods below
  if (method === 'initKeystore') {
    // Always prompt for user consent before storing any new keys in the store
    await allowAuthorization(meta.walletAddress, meta.env, origin);

    // initKeystore will check to ensure that the bundle matches the wallet address provided above
    return initKeystore(params);
  }

  // Check if the user has authorized this origin/wallet/env combination
  if (!(await authorizer.isAuthorized(meta.walletAddress, meta.env, origin))) {
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

async function handleDebug({ action }: { action: string }): Promise<any> {
  console.log('Handling debug action', action);
  if (action === 'clear') {
    await snap.request({
      method: 'snap_manageState',
      params: { operation: 'clear' },
    });
    return null;
  }

  if (action === 'read') {
    return snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    });
  }
  throw new Error('Unknown debug method');
}
