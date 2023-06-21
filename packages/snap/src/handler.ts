/* eslint-disable jsdoc/require-jsdoc */
import { InMemoryKeystore, keystoreApiDefs } from '@xmtp/xmtp-js';
import { conversationReference, fetcher } from '@xmtp/proto';

export type SnapRequest = {
  req: string;
};

export type SnapResponse = {
  res: string | string[];
};

export default function SnapKeystore(backingKeystore: InMemoryKeystore) {
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
  return {
    ...out,
    async getV2Conversations(): Promise<SnapResponse> {
      const result = await backingKeystore.getV2Conversations();

      return {
        res: result.map((ref) =>
          serializeResponse(ref, conversationReference.ConversationReference),
        ),
      };
    },

    async getAccountAddress(): Promise<SnapResponse> {
      const result = await backingKeystore.getAccountAddress();

      return {
        res: result,
      };
    },
  };
}

function serializeResponse(res: any, codec: any) {
  const responseBytes = codec.encode(res).finish();
  return fetcher.b64Encode(responseBytes, 0, responseBytes.length);
}
