import type { PropsWithChildren } from 'react';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'styled-components';

import { App } from './App';
import { dark, light } from './config/theme';
import {
  ToggleThemeContext,
  type ToggleTheme,
} from './contexts/ToggleThemeContext';
import { MetaMaskProvider } from './hooks';
import Index from './pages';
import { getThemePreference, setLocalStorage } from './utils';

const Root: React.FC<PropsWithChildren> = ({ children }) => {
  const [darkTheme, setDarkTheme] = useState(getThemePreference());

  const toggleTheme: ToggleTheme = () => {
    setLocalStorage('theme', darkTheme ? 'light' : 'dark');
    setDarkTheme(!darkTheme);
  };

  return (
    <ToggleThemeContext.Provider value={toggleTheme}>
      <ThemeProvider theme={darkTheme ? dark : light}>
        <MetaMaskProvider>{children}</MetaMaskProvider>
      </ThemeProvider>
    </ToggleThemeContext.Provider>
  );
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, no-restricted-globals
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root>
      <App>
        <Index />
      </App>
    </Root>
  </React.StrictMode>,
);
