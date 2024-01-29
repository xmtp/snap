import type { Client } from '@xmtp/xmtp-js';
import { useCallback } from 'react';

import { Button } from './Buttons';
import { Card } from './Card';

export const ListConversations = ({ client }: { client: Client | null }) => {
  const handleListConversations = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const conversations = await client.conversations.list();
      const conversationsString = conversations
        .map((convo) => convo.peerAddress)
        .join('\n');
      // eslint-disable-next-line no-console
      console.log('CONVERSATIONS =======================');
      // eslint-disable-next-line no-console
      console.log(conversationsString);
    } catch (error) {
      console.error(error);
    }
  }, [client]);

  if (!client) {
    return null;
  }

  return (
    <Card
      content={{
        title: 'List conversations with connected client',
        description: 'List all conversations',
        button: (
          <Button
            onClick={() => {
              void handleListConversations();
            }}
            disabled={!client}>
            Execute
          </Button>
        ),
      }}
      disabled={!client}
      fullWidth={false}
    />
  );
};
