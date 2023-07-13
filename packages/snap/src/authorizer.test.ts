import { XmtpEnv } from '@xmtp/xmtp-js';
import { Authorizer } from './authorizer';
import { sleep } from './testHelpers';
import { AUTHORIZATION_EXPIRY_MS } from './config';

const WALLET_ADDRESS = '0x1234';
const ENV = 'dev' as XmtpEnv;
const ORIGIN = 'https://example.com';

describe('Authorizer', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    let mockState = {};
    // Hacky test setup to mock the Snap storage
    mockRequest = jest.fn().mockImplementation(({ method, params }) => {
      if (method !== 'snap_manageState') {
        throw new Error('unsupported method');
      }

      const { operation } = params;
      if (operation === 'get') {
        return mockState;
      }

      if (operation === 'update') {
        const { newState } = params;
        mockState = newState;
        return null;
      }

      throw new Error('unknown operation');
    });

    (global as any).snap = {
      request: mockRequest,
    };
  });

  for (const useCache of [true, false]) {
    it(`returns false when no record exists (cache ${useCache})`, async () => {
      const authorizer = new Authorizer(AUTHORIZATION_EXPIRY_MS, useCache);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        false,
      );
    });

    it(`allows for authorization (cache: ${useCache})`, async () => {
      const authorizer = new Authorizer(AUTHORIZATION_EXPIRY_MS, useCache);
      await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        true,
      );
    });

    it(`stores different authorization statuses for different origins (cache: ${useCache})`, async () => {
      const authorizer = new Authorizer(AUTHORIZATION_EXPIRY_MS, useCache);
      await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        true,
      );

      expect(
        await authorizer.isAuthorized(
          WALLET_ADDRESS,
          ENV,
          'https://example2.com',
        ),
      ).toBe(false);
    });

    it(`handles expiration (cache: ${useCache})`, async () => {
      const authorizer = new Authorizer(1, useCache);
      await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        true,
      );

      await sleep(5);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        false,
      );
    });

    it(`allows for re-authorization after expiration (cache: ${useCache})`, async () => {
      const authorizer = new Authorizer(1, useCache);
      await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        true,
      );

      await sleep(5);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        false,
      );

      await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
      expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
        true,
      );
    });
  }
});
