import { XmtpEnv } from '@xmtp/xmtp-js';
import { Authorizer } from './authorizer';
import { sleep } from './testHelpers';

const WALLET_ADDRESS = '0x1234';
const ENV = 'dev' as XmtpEnv;
const ORIGIN = 'https://example.com';

describe('Authorizer', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    const mockState = {};
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
        Object.assign(mockState, newState);
        return null;
      }

      throw new Error('unknown operation');
    });

    (global as any).snap = {
      request: mockRequest,
    };
  });

  it('returns false when no record exists', async () => {
    const authorizer = new Authorizer();
    expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
      false,
    );
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('allows for authorization', async () => {
    const authorizer = new Authorizer();
    await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
    expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
      true,
    );

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('stores different authorization statuses for different origins', async () => {
    const authorizer = new Authorizer();
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

    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('handles expiration', async () => {
    const authorizer = new Authorizer(1);
    await authorizer.authorize(WALLET_ADDRESS, ENV, ORIGIN);
    expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
      true,
    );

    await sleep(5);
    expect(await authorizer.isAuthorized(WALLET_ADDRESS, ENV, ORIGIN)).toBe(
      false,
    );

    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('allows for re-authorization after expiration', async () => {
    const authorizer = new Authorizer(1);
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

    expect(mockRequest).toHaveBeenCalledTimes(5);
  });
});
