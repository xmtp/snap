/**
 * The snap origin to use.
 * Will default to the local hosted snap if no value is provided in environment.
 */
export const defaultSnapOrigin =
  import.meta.env.SNAP_ORIGIN ?? `local:http://localhost:8080`;

export const getSnapParams = () => {
  const envSnapVersion = import.meta.env.SNAP_VERSION;
  if (defaultSnapOrigin.startsWith('npm:') && envSnapVersion) {
    return { version: envSnapVersion };
  }
  return {};
};
