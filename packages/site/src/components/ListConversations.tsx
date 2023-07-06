import { Client } from '@xmtp/xmtp-js';
import { Card } from './Card';
import { Button } from './Buttons';
import { useCallback } from 'react';

export const ListConversations = ({ client }: { client: Client | null }) => {
  const handleListConversations = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const conversations = await client.conversations.list();
      alert(`Conversations: 

        ${conversations.map((c) => c.peerAddress).join('\n')}`);
    } catch (e) {
      console.error(e);
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
          <Button onClick={handleListConversations} disabled={!client}>
            Execute
          </Button>
        ),
      }}
      disabled={!client}
      fullWidth={false}
    />
  );
};
