# Pharos ProofPack Workflow

This reference file contains detailed instructions for each proof capability.

## General Flow

1. Identify the user's on-chain claim.
2. Select the matching proof command.
3. Read network configuration from `assets/networks.json`.
4. Run `bin/pharos-proofpack.mjs`.
5. Inspect `conclusion.verified`.
6. Return the evidence summary and `packHash`.

The blockchain does not know whether a user, script, bot, or AI agent requested the proof.
This Skill is an off-chain evidence generator for Pharos facts.

## Prove Chain

Use when the user needs to confirm that the RPC endpoint matches the expected Pharos chain.

Command:

    node bin/pharos-proofpack.mjs prove-chain \
      --network atlantic-testnet

Evidence collected:

- `eth_chainId`
- `eth_blockNumber`

## Prove Transaction

Use when the user claims a transaction exists, succeeded, failed, or was mined.

Command:

    node bin/pharos-proofpack.mjs prove-tx \
      --network atlantic-testnet \
      --tx <transaction-hash>

Evidence collected:

- `eth_getTransactionByHash`
- `eth_getTransactionReceipt`
- `eth_getBlockByNumber`

Conclusion:

- `verified: true` only when receipt exists and `status == 0x1`
- `verified: false` if missing, pending, failed, or not found

## Prove Contract

Use when the user claims an address is a deployed contract.

Command:

    node bin/pharos-proofpack.mjs prove-contract \
      --network atlantic-testnet \
      --address <contract-address>

Evidence collected:

- `eth_getCode`
- `eth_getProof` when supported by RPC

Conclusion:

- `verified: true` if bytecode exists
- `verified: false` if bytecode is `0x`

## Prove Account

Use when the user needs account balance, nonce, code, and proof data.

Command:

    node bin/pharos-proofpack.mjs prove-account \
      --network atlantic-testnet \
      --address <address>

Evidence collected:

- `eth_getBalance`
- `eth_getTransactionCount`
- `eth_getCode`
- `eth_getProof` when supported by RPC

## Prove Storage

Use when the user needs evidence for a storage slot.

Command:

    node bin/pharos-proofpack.mjs prove-storage \
      --network atlantic-testnet \
      --address <contract-address> \
      --slot <storage-slot>

Evidence collected:

- `eth_getStorageAt`
- `eth_getProof` with requested storage slot when supported by RPC

## Prove Call

Use when the user needs evidence for a read-only call result.

Command:

    node bin/pharos-proofpack.mjs prove-call \
      --network atlantic-testnet \
      --to <contract-address> \
      --data <calldata>

Evidence collected:

- `eth_getCode`
- `eth_call`

## Verify Proofpack

Use when the user provides a generated proofpack and wants to check its integrity.

Command:

    node bin/pharos-proofpack.mjs verify-pack \
      --file <proofpack-json-file>

Verification checks:

- `packHash` matches canonical JSON
- required fields exist
- transaction conclusion matches receipt status
- contract conclusion matches bytecode presence
