# @xmtp/snap-monorepo

![Status](https://img.shields.io/badge/Deprecated-brown)

> [!CAUTION]
> This XMTP V2 snap repo is no longer maintained.

In the future, we may create a new snap for XMTP V3.

The documentation below is provided for historical reference only.

---

This repository contains the XMTP Snap, released via NPM here, as well as a small webapp to demo the functionality. It was generated using the [template-snap repository](https://github.com/MetaMask/template-snap-monorepo/generate)

## Architecture

The XMTP Snap is an implementation of the Keystore API, a defined interface for XMTP clients to interact with a Keystore holding XMTP key material.

### RPC Code Generation

The Keystore API is defined in Protobuf, but Snaps are required to communicate via JSON-RPC. To allow clients to communicate with the Snap Keystore, all request protos are serialized and base64 encoded. In the snap, requests are base64 decoded and deserialized and then responses are once again serialized and base64 encoded.

This is done automatically, using [RPC definitions defined in `xmtp-js`](https://github.com/xmtp/xmtp-js/blob/snap/src/keystore/rpcDefinitions.ts) that define expected request and response types for each method.

### Authentication

Two methods in the Snap allow unauthenticated access. `initKeystore` and `getKeystoreStatus`. Even unauthenticated APIs require the user to have previously installed the Snap and authorized the origin to connect to it.

`initKeystore` takes an XMTP `PrivateKeyBundle` as an argument and saves it in the Snaps storage. Upon successful validation and storage of the XMTP keys, the origin that called `initKeystore` is authorized to make calls to restricted Keystore methods for 30 days.

`getKeystoreStatus` allows the caller to check if keys are present in the Snap storage for a given wallet address/environment combination. Clients are expected to call this method at the beginning of a session to see if they need to call generate/load the keys themselves and call `initKeystore` or simply proceed using the already stored keys.

All other RPC methods require authorization. A successful call to `initKeystore` automatically authorizes the current origin to use the provided keys for 30 days. For calls from other origins, or calls > 30 days after the last authorization, the user will need to approve a confirmation modal in Metamask to authorize that domain for the next 30 days. Clients should throw an error if authorization is rejected and apps are expected to handle that error.

### Storage

The built-in Snap storage is used for three tasks:

1. Storing authorization status for each origin/wallet address/env combination that has used the Snap
2. Storing the `PrivateKeyBundle` for a given wallet address and env.
3. Storing the conversation keys for a given wallet address and env.

Both `2` and `3` are highly sensitive material. At no time should these materials be accessible outside the Snap (via RPCs, console.log, or any other mechanism). It should not be possible to manipulate the values in `1` outside of the mechanisms described in [Authentication](#authentication).

## Contributing

See our [contribution guide](./CONTRIBUTING.md) to learn more about contributing to this project.
