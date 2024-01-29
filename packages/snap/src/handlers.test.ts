import { describe, it, expect } from '@jest/globals';
import { installSnap } from '@metamask/snaps-jest';
import { keystore } from '@xmtp/proto';
import type { XmtpEnv } from '@xmtp/xmtp-js';
import { PrivateKeyBundleV1 } from '@xmtp/xmtp-js';

import { buildRpcRequest, newWallet } from './testHelpers';
import { base64Decode, base64Encode } from './utils';

const {
  InitKeystoreRequest,
  GetKeystoreStatusRequest,
  GetKeystoreStatusResponse,
  GetKeystoreStatusResponse_KeystoreStatus: KeystoreStatus,
} = keystore;

const ENV: XmtpEnv = 'dev';

describe('onRPCRequest', () => {
  describe('initKeystore', () => {
    it('should allow initializing with a valid bundle', async () => {
      const bundle = await PrivateKeyBundleV1.generate(newWallet());
      const walletAddress =
        bundle.identityKey.publicKey.walletSignatureAddress();

      const serialized = InitKeystoreRequest.encode({
        v1: bundle,
      }).finish();

      const meta = {
        walletAddress,
        env: ENV,
      };

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();

      // Check the status of a fresh instance
      const initialStatus = await request(
        buildRpcRequest(
          'getKeystoreStatus',
          base64Encode(
            GetKeystoreStatusRequest.encode({ walletAddress }).finish(),
          ),
          meta,
        ),
      );

      // Make sure it shows as unititialized
      expect(initialStatus).toRespondWith({
        res: base64Encode(
          GetKeystoreStatusResponse.encode({
            status: KeystoreStatus.KEYSTORE_STATUS_UNINITIALIZED,
          }).finish(),
        ),
      });

      expect(
        await request(
          buildRpcRequest('initKeystore', base64Encode(serialized), {
            walletAddress,
            env: ENV,
          }),
        ),
      ).not.toRespondWithError(undefined);

      const status = await request(
        buildRpcRequest(
          'getKeystoreStatus',
          base64Encode(
            GetKeystoreStatusRequest.encode({ walletAddress }).finish(),
          ),
          meta,
        ),
      );

      expect(status).toRespondWith({
        res: base64Encode(
          GetKeystoreStatusResponse.encode({
            status: KeystoreStatus.KEYSTORE_STATUS_INITIALIZED,
          }).finish(),
        ),
      });
    });
  });

  describe('keystore handlers', () => {
    const initKeystore = async (
      bundle: PrivateKeyBundleV1,
      request: Awaited<ReturnType<typeof installSnap>>['request'],
    ) => {
      const serialized = InitKeystoreRequest.encode({
        v1: bundle,
      }).finish();

      const walletAddress =
        bundle.identityKey.publicKey.walletSignatureAddress();

      const meta = {
        walletAddress,
        env: ENV,
      };

      await request(
        buildRpcRequest('initKeystore', base64Encode(serialized), meta),
      );
    };

    it('can return the public key', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const publicKeyResponse = await request(
        buildRpcRequest('getPublicKeyBundle', null, meta),
      );
      expect(publicKeyResponse).toRespondWith({
        res: base64Encode(bundle.getPublicKeyBundle().toBytes()),
      });
    });

    it('returns an error if unknown handler is called', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const response = await request(
        buildRpcRequest('unknownHandler', null, meta),
      );
      expect('error' in response.response).toBe(true);
      if ('error' in response.response) {
        expect(response.response.error).toBeDefined();
      }
    });

    it('prompts for authorization', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const response = request({
        ...buildRpcRequest('getPublicKeyBundle', null, meta),
        origin: 'http://somewhere-different.com',
      });
      if (!('getInterface' in response)) {
        throw new Error('No dialog present');
      }
      const ui = await response.getInterface();
      await ui.ok();

      expect(ui.type).toBe('confirmation');
      const result = await response;
      expect('result' in result.response).toBe(true);
      if ('result' in result.response) {
        expect(result.response.result).toBeDefined();
      }
      expect('error' in result.response).toBe(false);
    });

    it('throws errors on rejected authorization', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const response = request({
        ...buildRpcRequest('getPublicKeyBundle', null, meta),
        origin: 'http://somewhere-different.com',
      });
      if (!('getInterface' in response)) {
        throw new Error('No confirmation present in Snap');
      }
      const ui = await response.getInterface();
      if (ui.type === 'confirmation' || ui.type === 'prompt') {
        await ui.cancel();
      }

      expect(ui.type).toBe('confirmation');
      const result = await response;
      expect('result' in result.response).toBe(false);
      expect('error' in result.response).toBe(true);
      if ('error' in result.response) {
        expect(result.response.error).toBeDefined();
      }
    });

    it('talks to wasm', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const originalData = new Uint8Array([1, 2, 3, 4]);

      const encryptRequest = keystore.SelfEncryptRequest.encode({
        requests: [
          {
            payload: originalData,
          },
        ],
      }).finish();

      const encryptResponse = await request({
        ...buildRpcRequest('selfEncrypt', base64Encode(encryptRequest), meta),
      });

      expect(
        'response' in encryptResponse &&
          'result' in encryptResponse.response &&
          typeof encryptResponse.response.result === 'object' &&
          encryptResponse.response.result !== null &&
          'res' in encryptResponse.response.result,
      ).toBe(true);

      if (
        'response' in encryptResponse &&
        'result' in encryptResponse.response &&
        typeof encryptResponse.response.result === 'object' &&
        encryptResponse.response.result !== null &&
        'res' in encryptResponse.response.result
      ) {
        const resultPayload = encryptResponse.response.result.res;
        const decodedEncryptResponse = keystore.SelfEncryptResponse.decode(
          base64Decode(JSON.stringify(resultPayload)),
        );
        const decryptRequest = keystore.SelfDecryptRequest.encode({
          requests: [
            {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              payload: decodedEncryptResponse.responses[0].result!.encrypted,
            },
          ],
        }).finish();

        const decryptResponse = request({
          ...buildRpcRequest('selfDecrypt', base64Encode(decryptRequest), meta),
        });

        const decryptResultPayload = ((await decryptResponse) as any).response
          ?.result.res;
        const decryptResultProto = keystore.DecryptResponse.decode(
          base64Decode(decryptResultPayload),
        );
        expect(decryptResultProto.responses[0].result?.decrypted).toEqual(
          originalData,
        );
      }
    });
  });
});
