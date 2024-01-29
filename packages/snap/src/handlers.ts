import { fetcher, keystore as keystoreProto } from '@xmtp/proto';
import type {
  InMemoryKeystore,
  KeystoreApiEntries,
  KeystoreApiMethods,
  KeystoreRPCCodec,
  SnapKeystoreApiDefs,
  SnapKeystoreApiMethods,
  SnapKeystoreInterface,
  SnapKeystoreInterfaceRequestValues,
  XmtpEnv,
} from '@xmtp/xmtp-js';
import { PrivateKeyBundleV1, keystoreApiDefs } from '@xmtp/xmtp-js';
import { KeyNotFoundError } from './errors';
import { getPersistence } from './persistence';
import { getKeys, setKeys } from './keys';

const {
  GetKeystoreStatusResponse_KeystoreStatus: KeystoreStatus,
  InitKeystoreRequest,
  InitKeystoreResponse,
  GetKeystoreStatusRequest,
  GetKeystoreStatusResponse,
} = keystoreProto;
const { b64Decode, b64Encode } = fetcher;

export type SnapMeta = {
  walletAddress: string;
  env: XmtpEnv;
};

export type SnapRequest = {
  req: string;
  meta: SnapMeta;
};

export type SnapResponse = {
  res: string | string[];
};

function serializeResponse<R>(codec: KeystoreRPCCodec<R>, res: R) {
  const responseBytes = codec.encode(res).finish();
  console.log('responseBytes', responseBytes);
  return { res: b64Encode(responseBytes, 0, responseBytes.length) };
}

type RequestHandlerWithoutReq<T extends SnapKeystoreApiMethods> =
  () => ReturnType<SnapKeystoreInterface[T]>;

export async function processProtoRequest<T extends SnapKeystoreApiMethods>(
  method: T,
  rpc: SnapKeystoreApiDefs[T],
  request: SnapRequest,
  handler: (
    req?: SnapKeystoreInterfaceRequestValues[T],
  ) => ReturnType<SnapKeystoreInterface[T]>,
): Promise<SnapResponse> {
  if (rpc.req === null) {
    const result = await (handler as RequestHandlerWithoutReq<T>)();
    return serializeResponse(rpc.res as SnapKeystoreApiDefs[T]['res'], result);
  }

  if (typeof request.req !== 'string') {
    throw new Error(`Expected string request. Got: ${typeof request.req}`);
  }

  const decodedRequest = rpc.req.decode(b64Decode(request.req)) as NonNullable<
    SnapKeystoreInterfaceRequestValues[T]
  >;

  const result = await handler(decodedRequest);
  console.log('result', result);
  console.log('serialized response', serializeResponse(rpc.res, result));
  return serializeResponse(rpc.res, result);
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
      // eslint-disable-next-line no-console
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

type Handler = (req: SnapRequest) => Promise<SnapResponse>;
type HandlerMap = Record<KeystoreApiMethods, Handler>;

export function keystoreHandler(backingKeystore: InMemoryKeystore) {
  const out: Partial<HandlerMap> = {};
  for (const [method, rpc] of Object.entries(
    keystoreApiDefs,
  ) as KeystoreApiEntries) {
    if (!(method in backingKeystore)) {
      throw new Error('no method found in keystore');
    }

    out[method] = async (req: SnapRequest) => {
      const backingMethod = backingKeystore[method];
      if (typeof backingMethod !== 'function') {
        throw new Error('not a function');
      }

      return processProtoRequest(
        method,
        rpc,
        req,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        backingMethod.bind(backingKeystore) as any,
      );
    };
  }
  return out as HandlerMap;
}
