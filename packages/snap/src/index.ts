/* eslint-disable jsdoc/require-jsdoc */
import './polyfills'; // eslint-disable-line import/no-unassigned-import
import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text, heading } from '@metamask/snaps-ui';
import {
  getHandler,
  setHandler,
  bootstrapKeystore,
  getSigner,
  isSnapRequest,
  truncate,
} from './utils';

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
  console.log('Method', request.method, 'params', request.params);
  const signer = getSigner();
  if (request.method === 'init') {
    const address = await signer.getAddress();
    const approved = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'confirmation',
        content: panel([
          heading(`Connection request`),
          text(
            `This will allow ${origin} to read and write messages on behalf of ${truncate(
              address,
              12,
            )}`,
          ),
        ]),
      },
    });

    if (!approved) {
      throw new Error('Not approved!');
    }

    try {
      await getHandler(address, 'dev');
      console.log('Got a handler from stored keys');
    } catch (e) {
      console.log('Could not get handler', e);
      setHandler(await bootstrapKeystore('dev'));
    }

    return {
      address,
    };
  }

  const handler = await getHandler(await signer.getAddress(), 'dev');
  if (request.method in handler && isSnapRequest(request.params)) {
    return handler[request.method as keyof typeof handler](request.params);
  }
  throw new Error('Invalid method');
};
