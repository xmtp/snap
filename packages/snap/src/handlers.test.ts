import { PrivateKeyBundleV1, XmtpEnv } from '@xmtp/xmtp-js';
import { keystore } from '@xmtp/proto';
import { installSnap } from '@metamask/snaps-jest';
import { buildRpcRequest, newWallet } from './testHelpers';
import { base64Encode } from './utils';

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

      const { request } = await installSnap();

      // Make sure it returns unitialized when new
      const initialStatus = await request(
        buildRpcRequest(
          'getKeystoreStatus',
          base64Encode(
            GetKeystoreStatusRequest.encode({ walletAddress }).finish(),
          ),
          meta,
        ),
      );

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
      ).not.toRespondWithError();

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
      const { request } = await installSnap();
      await initKeystore(bundle, request);
      const meta = {
        walletAddress: bundle.identityKey.publicKey.walletSignatureAddress(),
        env: ENV,
      };

      const response = await request(
        buildRpcRequest('unknownHandler', null, meta),
      );
      expect((response.response as any).error).toBeDefined();
    });

    it('prompts for authorization', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
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
      const ui = await (response as any).getInterface();
      await ui.ok();

      expect(ui.type).toBe('confirmation');
      const result = await response;
      expect((result.response as any).result).toBeDefined();
      expect((result.response as any).error).toBeUndefined();
    });

    it('throws errors on rejected authorization', async () => {
      const wallet = newWallet();
      const bundle = await PrivateKeyBundleV1.generate(wallet);
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
      const ui = await (response as any).getInterface();
      await ui.cancel();

      expect(ui.type).toBe('confirmation');
      const result = await response;
      expect((result.response as any).result).toBeUndefined();
      expect((result.response as any).error).toBeDefined();
    });
  });
});
