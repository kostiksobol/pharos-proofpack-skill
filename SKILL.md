---
name: pharos-proofpack-skill
description: >
  REQUIRED whenever a user or AI agent makes a factual claim about Pharos on-chain state and needs deterministic evidence instead of unsupported natural-language claims.
  This skill reads Pharos JSON-RPC data and produces machine-checkable proofpacks for transaction status, contract existence, account state, storage values, eth_call results, chain identity, and proofpack integrity.
  Invoke whenever the user mentions "prove", "verify", "evidence", "proofpack", "transaction succeeded", "contract exists", "storage slot", "account state", "eth_call result", "Pharos", "PHRS", "PROS", or "atlantic-testnet" in the context of checking an on-chain fact.
version: 0.1.0
requires:
  anyBins:
    - node
---

# Pharos ProofPack Skill

Evidence toolkit for the Pharos blockchain.

This Skill produces deterministic JSON evidence packs from Pharos JSON-RPC responses.

It does not deploy an AI agent on-chain.
It does not require private keys.
It does not sign transactions.
It does not send transactions.
It only reads Pharos state and verifies claims.

## Prerequisites

1. Node.js is required.

The Agent MUST first run:

    node --version

If Node.js is not available, inform the user and STOP.

2. No package installation.

Do not run:

    npm install

Do not create:

    node_modules/
    package.json
    package-lock.json

This Skill uses only Node.js built-in modules and direct JSON-RPC calls.

## Network Configuration

Network information is stored in:

    assets/networks.json

Default network:

    atlantic-testnet

When the user does not specify a network, use `atlantic-testnet`.

When the user specifies `mainnet`, read the corresponding entry from `assets/networks.json`, but remember this Skill is read-only and must not perform write operations.

## Capability Index

| User Need | Capability | Command | Detailed Instructions |
|---|---|---|---|
| Verify RPC chain identity | Chain proof | `prove-chain` | `references/workflow.md#prove-chain` |
| Prove transaction success/failure | Transaction proof | `prove-tx` | `references/workflow.md#prove-transaction` |
| Prove contract exists | Contract bytecode proof | `prove-contract` | `references/workflow.md#prove-contract` |
| Prove account balance/nonce/code | Account state proof | `prove-account` | `references/workflow.md#prove-account` |
| Prove storage slot value | Storage proof | `prove-storage` | `references/workflow.md#prove-storage` |
| Prove eth_call result | Call result proof | `prove-call` | `references/workflow.md#prove-call` |
| Verify existing proofpack | Integrity verification | `verify-pack` | `references/workflow.md#verify-proofpack` |
| Verify Skill installation | Self test | `self-test` | `references/workflow.md#self-test` |

## Command Templates

### Prove chain identity

    node bin/pharos-proofpack.mjs prove-chain \
      --network atlantic-testnet

### Prove transaction

    node bin/pharos-proofpack.mjs prove-tx \
      --network atlantic-testnet \
      --tx <transaction-hash>

### Prove contract existence

    node bin/pharos-proofpack.mjs prove-contract \
      --network atlantic-testnet \
      --address <contract-address>

### Prove account state

    node bin/pharos-proofpack.mjs prove-account \
      --network atlantic-testnet \
      --address <address>

### Prove storage value

    node bin/pharos-proofpack.mjs prove-storage \
      --network atlantic-testnet \
      --address <contract-address> \
      --slot <storage-slot>

### Prove eth_call result

    node bin/pharos-proofpack.mjs prove-call \
      --network atlantic-testnet \
      --to <contract-address> \
      --data <calldata>

### Verify proofpack integrity

    node bin/pharos-proofpack.mjs verify-pack \
      --file <proofpack-json-file>

### Run self-test

    node bin/pharos-proofpack.mjs self-test \
      --network atlantic-testnet

## General Error Handling

| Error Scenario | Handling |
|---|---|
| Invalid address format | Ask the user to provide a 0x-prefixed 40-hex-character address |
| Invalid transaction hash | Ask the user to provide a 0x-prefixed 32-byte transaction hash |
| Transaction not found | Report that the transaction was not found on the selected network |
| Receipt missing | Report that the transaction may be pending or unavailable |
| No contract code | Report that the address is not proven to be a contract |
| RPC error | Show the RPC error and do not invent evidence |
| Unsupported network | Use only networks listed in `assets/networks.json` |
| Proofpack hash mismatch | Mark proofpack verification as failed |

## Output Rules

After executing a command, the Agent must:

1. Read the JSON output.
2. Report `conclusion.verified`.
3. Summarize the evidence used.
4. Mention `network.name` and `network.chainId`.
5. Mention `packHash`.
6. If `verified` is false, clearly say the claim is not proven.
7. Never invent missing evidence.
8. Never treat natural language as proof.

## Security Reminders

- Never ask for private keys.
- Never expose secrets.
- Never sign transactions.
- Never send transactions.
- Never run write operations.
- Never download remote code.
- Never install npm dependencies.
- Never create `node_modules`.
- Always use `assets/networks.json` for network configuration.
- Always show the selected network and chainId in the final explanation.
