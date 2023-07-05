/* eslint-disable jsdoc/require-jsdoc */
import {
  InMemoryKeystore,
  PrivateKeyBundleV1,
  keystoreApiDefs,
} from '@xmtp/xmtp-js';
import { conversationReference, fetcher } from '@xmtp/proto';
import { Reader, Writer } from 'protobufjs/minimal';
import { SnapMeta } from '.';
import { keystore as keystoreProto } from '@xmtp/proto';
import {
  InitKeystoreRequest as InitKeystoreRequestType,
  InitKeystoreResponse as InitKeystoreResponseType,
  GetKeystoreStatusRequest as GetKeystoreStatusRequestType,
  GetKeystoreStatusResponse as GetKeystoreStatusResponseType,
} from '@xmtp/proto/ts/keystore_api/v1/keystore.pb';
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
      const persistence = getPersistence(req.meta.walletAddress, req.meta.env);
      await setKeys(
        persistence,
        new PrivateKeyBundleV1(initKeystoreRequest.v1),
      );

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
      if (!apiDef.req) {
        // eslint-disable-next-line
        // @ts-ignore-next-line
        const result = await backingKeystore[
          method as keyof InMemoryKeystore
        ]();

        return {
          res: serializeResponse(result, apiDef.res),
        };
      }
      const request = apiDef.req.decode(fetcher.b64Decode(req.req));
      // eslint-disable-next-line
      // @ts-ignore-next-line
      const result = await backingKeystore[method](request as any);
      const serialized = serializeResponse(result, apiDef.res);
      return {
        res: serialized,
      };
    };
  }
  return out;
}
