import dotenv from 'dotenv';
import type { GatsbyConfig } from 'gatsby';

dotenv.config({
  // eslint-disable-next-line no-restricted-globals, @typescript-eslint/no-non-null-assertion
  path: `.env.${process.env.NODE_ENV!}`,
});

const config: GatsbyConfig = {
  // This is required to make use of the React 17+ JSX transform.
  jsxRuntime: 'automatic',

  plugins: [
    'gatsby-plugin-svgr',
    'gatsby-plugin-styled-components',
    {
      resolve: 'gatsby-plugin-manifest',
      options: {
        name: 'Template Snap',
        icon: 'src/assets/logo.svg',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        theme_color: '#6F4CFF',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        background_color: '#FFFFFF',
        display: 'standalone',
      },
    },
  ],
};

export default config;
