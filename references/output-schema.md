# Output Schema

Every proofpack contains these top-level fields:

- `proofpackVersion`
- `tool`
- `generatedAt`
- `network`
- `command`
- `claim`
- `evidence`
- `conclusion`
- `packHash`

Example structure:

    {
      "proofpackVersion": "0.1.0",
      "tool": "pharos-proofpack-skill",
      "generatedAt": "ISO timestamp",
      "network": {
        "name": "atlantic-testnet",
        "chainId": 688689,
        "rpcUrl": "https://...",
        "explorerUrl": "https://...",
        "nativeToken": "PHRS"
      },
      "command": "prove-tx",
      "claim": {},
      "evidence": {},
      "conclusion": {
        "verified": true,
        "summary": "..."
      },
      "packHash": "sha256:..."
    }

## Hash Rule

`packHash` is calculated from canonical JSON excluding `packHash` itself.

The hash is used to detect tampering with proofpack contents.

## Important

A proofpack is evidence collected from RPC responses.

It is not:

- a private key
- a signature
- a transaction
- a wallet authorization
- a guarantee that future state will remain the same

## Compact RPC Proofs

By default, the Skill does not include full raw `eth_getProof` payloads because they can be extremely large.

Instead, proofpack evidence includes compact proof summaries:

- `rawIncluded: false`
- `rawHash`
- account proof node count
- account proof hash
- storage proof count
- storage proof hashes

To include the full raw RPC proof, run commands with:

    --include-raw-proof

Use raw proof mode only when the user explicitly needs full proof material.
