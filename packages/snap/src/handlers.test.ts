import { PrivateKeyBundleV1, XmtpEnv } from '@xmtp/xmtp-js';
import { buildRpcRequest, newWallet } from './testHelpers';
import { fetcher, keystore } from '@xmtp/proto';
import { base64Encode } from './utils';
import { installSnap } from '@metamask/snaps-jest';

const { b64Encode } = fetcher;
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
});
