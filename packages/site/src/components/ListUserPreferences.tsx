import type { Client } from '@xmtp/xmtp-js';
import { useCallback } from 'react';

import { Button } from './Buttons';
import { Card } from './Card';

export const ListUserPreferences = ({ client }: { client: Client | null }) => {
  const handleList = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      const entries = await client.contacts.refreshConsentList();
      const entriesString = entries
        .map((entry) => `${entry.key}:${entry.permissionType}`)
        .join('\n');
      // eslint-disable-next-line no-console
      console.log('ENTRIES =======================');
      // eslint-disable-next-line no-console
      console.log(entriesString);
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
        title: 'List user preferences associated with connected client',
        description: 'List user preferences',
        button: (
          <Button
            onClick={() => {
              void handleList();
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
