// eslint-disable-next-line import/no-nodejs-modules
import { Buffer } from 'buffer';

// eslint-disable-next-line no-restricted-globals
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-restricted-globals
  window.Buffer = window.Buffer ?? Buffer;
}
