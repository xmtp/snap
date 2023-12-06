import type { Client } from '@xmtp/xmtp-js';
import { useCallback } from 'react';

import { Button } from './Buttons';
import { Card } from './Card';

export const ListUserPreferences = ({ client }: { client: Client | null }) => {
  const handleClick = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const entries = await client.contacts.refreshConsentList();
      alert(`Entries: 

        ${entries.map((e) => `${e.key}:${e.value}`).join('\n')}`);
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
        title: 'List user preferences associated with connected client',
        description: 'List user preferences',
        button: (
          <Button onClick={handleClick} disabled={!client}>
            Execute
          </Button>
        ),
      }}
      disabled={!client}
      fullWidth={false}
    />
  );
};
