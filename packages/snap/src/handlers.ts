/* eslint-disable jsdoc/require-jsdoc */
import {
  InMemoryKeystore,
  PrivateKeyBundleV1,
  keystoreApiDefs,
} from '@xmtp/xmtp-js';
import { fetcher, keystore as keystoreProto } from '@xmtp/proto';
import { Reader, Writer } from 'protobufjs/minimal';
import {
  InitKeystoreRequest as InitKeystoreRequestType,
  InitKeystoreResponse as InitKeystoreResponseType,
  GetKeystoreStatusRequest as GetKeystoreStatusRequestType,
  GetKeystoreStatusResponse as GetKeystoreStatusResponseType,
  // eslint-disable-next-line import/extensions
} from '@xmtp/proto/ts/dist/types/keystore_api/v1/keystore.pb';
import { getKeys, getPersistence, setKeys } from './utils';
import { KeyNotFoundError } from './errors';
import { SnapMeta } from '.';

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

type Codec<T> = {
  decode(input: Reader | Uint8Array, length?: number): T;
  encode(message: T, writer?: Writer): Writer;
};

export type SnapRPC<Req, Res> = {
  req: Codec<Req> | null;
  res: Codec<Res>;
};

export async function processProtoRequest<Req, Res>(
  rpc: SnapRPC<Req, Res>,
  request: SnapRequest,
  handler: (req?: Req) => Promise<Res>,
): Promise<SnapResponse> {
  if (rpc.req === null) {
    const result = await handler();
    return serializeResponse(rpc.res, result);
  }

  if (typeof request.req !== 'string') {
    throw new Error('Expected string response');
  }

  const decodedRequest = rpc.req.decode(b64Decode(request.req));
  const result = await handler(decodedRequest);
  return serializeResponse(rpc.res, result);
}

function serializeResponse<T>(codec: Codec<T>, res: T) {
  const responseBytes = codec.encode(res).finish();
  return { res: b64Encode(responseBytes, 0, responseBytes.length) };
}

const initKeystoreRPC: SnapRPC<
  InitKeystoreRequestType,
  InitKeystoreResponseType
> = {
  req: InitKeystoreRequest,
  res: InitKeystoreResponse,
};

export async function initKeystore(req: SnapRequest): Promise<SnapResponse> {
  return processProtoRequest(
    initKeystoreRPC,
    req,
    async (initKeystoreRequest) => {
      if (!initKeystoreRequest?.v1) {
        throw new Error('missing v1 keys');
      }
      const bundle = new PrivateKeyBundleV1(initKeystoreRequest.v1);
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

      return {};
    },
  );
}

const getKeystoreStatusRPC: SnapRPC<
  GetKeystoreStatusRequestType,
  GetKeystoreStatusResponseType
> = {
  req: GetKeystoreStatusRequest,
  res: GetKeystoreStatusResponse,
};

export async function getKeystoreStatus(
  req: SnapRequest,
): Promise<SnapResponse> {
  return processProtoRequest(
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
      } catch (e) {
        console.log(e);
        // Only swallow KeyNotFoundError and turn into a negative response
        if (!(e instanceof KeyNotFoundError)) {
          throw e;
        }
        return {
          status: KeystoreStatus.KEYSTORE_STATUS_UNINITIALIZED,
        };
      }
    },
  );
}

export function KeystoreHandler(backingKeystore: InMemoryKeystore) {
  const out: any = {};
  for (const [method, apiDef] of Object.entries(keystoreApiDefs)) {
    if (!(method in backingKeystore)) {
      throw new Error('No backing method');
    }

    out[method] = async (req: SnapRequest): Promise<SnapResponse> => {
      return processProtoRequest(
        apiDef,
        req,
        backingKeystore[method as keyof InMemoryKeystore].bind(
          backingKeystore,
        ) as any,
      );
    };
  }
  return out;
}
