/* eslint-disable jsdoc/require-jsdoc */
import { fetcher, keystore as keystoreProto } from '@xmtp/proto';
import type {
  InMemoryKeystore,
  KeystoreApiEntries,
  KeystoreRPCCodec,
  SnapKeystoreApiDefs,
  SnapKeystoreApiMethods,
  SnapKeystoreInterface,
  SnapKeystoreInterfaceRequestValues,
} from '@xmtp/xmtp-js/browser/bundler';
import {
  PrivateKeyBundleV1,
  keystoreApiDefs,
} from '@xmtp/xmtp-js/browser/bundler';

import type { SnapMeta } from '.';
import { KeyNotFoundError } from './errors';
import { getKeys, getPersistence, setKeys } from './utils';

const {
  GetKeystoreStatusResponse_KeystoreStatus: KeystoreStatus,
  InitKeystoreRequest,
  InitKeystoreResponse,
  GetKeystoreStatusRequest,
  GetKeystoreStatusResponse,
} = keystoreProto;
const { b64Decode, b64Encode } = fetcher;

export type SnapRequest = {
  req: string;
  meta: SnapMeta;
};

export type SnapResponse = {
  res: string | string[];
};

export async function processProtoRequest<
  Method extends SnapKeystoreApiMethods,
>(
  method: Method,
  rpc: SnapKeystoreApiDefs[Method],
  request: SnapRequest,
  handler: (
    req?: SnapKeystoreInterfaceRequestValues[Method],
  ) => ReturnType<SnapKeystoreInterface[Method]>,
): Promise<SnapResponse> {
  console.log('Processing request method', method);

  if (rpc.req === null) {
    const result = await handler();
    return serializeResponse(
      rpc.res as SnapKeystoreApiDefs[Method]['res'],
      result,
    );
  }

  if (typeof request.req !== 'string') {
    throw new Error(`Expected string request. Got: ${typeof request.req}`);
  }

  const decodedRequest = rpc.req.decode(
    b64Decode(request.req),
  ) as SnapKeystoreInterfaceRequestValues[Method];
  const result = await handler(decodedRequest);
  return serializeResponse(rpc.res, result);
}

function serializeResponse<MessageType>(
  codec: KeystoreRPCCodec<MessageType>,
  res: MessageType,
) {
  const responseBytes = codec.encode(res).finish();
  return { res: b64Encode(responseBytes, 0, responseBytes.length) };
}

const initKeystoreRPC = {
  req: InitKeystoreRequest,
  res: InitKeystoreResponse,
};

// Handler for `initKeystore` RPCs, which set the keys in the persistence layer
export async function initKeystore(req: SnapRequest): Promise<SnapResponse> {
  return processProtoRequest(
    'initKeystore',
    initKeystoreRPC,
    req,
    async (initKeystoreRequest) => {
      if (!initKeystoreRequest?.v1) {
        throw new Error('missing v1 keys');
      }
      const bundle = new PrivateKeyBundleV1(initKeystoreRequest.v1);
      if (!bundle.validatePublicKeys()) {
        throw new Error('invalid public keys');
      }

      // Ensure that the signature on the bundle's public key matches the stated wallet address
      if (
        bundle.identityKey.publicKey.walletSignatureAddress() !==
        req.meta.walletAddress
      ) {
        throw new Error('mismatched private key and meta fields');
      }
      const persistence = getPersistence(req.meta.walletAddress, req.meta.env);
      console.log(
        `Setting keys for ${req.meta.walletAddress} in env ${req.meta.env}}`,
      );
      await setKeys(persistence, bundle);

      return {
        error: undefined,
      };
    },
  );
}

const getKeystoreStatusRPC = {
  req: GetKeystoreStatusRequest,
  res: GetKeystoreStatusResponse,
};

// Handler for `getKeystoreStatus` RPCs, which tells the client whether the keystore has been initialized
// for the given wallet address and env
export async function getKeystoreStatus(
  req: SnapRequest,
): Promise<SnapResponse> {
  return processProtoRequest(
    'getKeystoreStatus',
    getKeystoreStatusRPC,
    req,
    async (getKeystoreStatusRequest) => {
      const walletAddress = getKeystoreStatusRequest?.walletAddress;
      if (walletAddress !== req.meta.walletAddress) {
        throw new Error('wallet address does not match metadata');
      }

      try {
        const persistence = getPersistence(
          req.meta.walletAddress,
          req.meta.env,
        );
        // This will throw if no keys are present in the Snap data store
        await getKeys(persistence);
        return {
          status: KeystoreStatus.KEYSTORE_STATUS_INITIALIZED,
        };
      } catch (error) {
        // Only swallow KeyNotFoundError and turn into a negative response
        if (!(error instanceof KeyNotFoundError)) {
          throw error;
        }
        return {
          status: KeystoreStatus.KEYSTORE_STATUS_UNINITIALIZED,
        };
      }
    },
  );
}

export function keystoreHandler(backingKeystore: InMemoryKeystore) {
  const out: any = {};
  for (const [method, apiDef] of Object.entries(
    keystoreApiDefs,
  ) as KeystoreApiEntries) {
    if (!(method in backingKeystore)) {
      throw new Error('no method found in keystore');
    }

    // eslint-disable-next-line no-loop-func
    out[method] = async (req: SnapRequest): Promise<SnapResponse> => {
      const backingMethod = backingKeystore[method];
      if (typeof backingMethod !== 'function') {
        throw new Error('not a function');
      }
      return processProtoRequest(
        method,
        apiDef,
        req,
        backingMethod.bind(backingKeystore) as any,
      );
    };
  }
  return out;
}
