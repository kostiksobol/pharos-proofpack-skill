# Safety

This Skill is read-only.

It must never:

- request private keys
- sign transactions
- send transactions
- download dependencies
- execute remote code
- store secrets
- claim proof without evidence
- treat natural-language statements as evidence

If RPC data is missing, the Skill must return an unverified result instead of guessing.

## Agent Rule

The Agent must not say:

    This is proven.

unless the proofpack conclusion says:

    "verified": true

## Mainnet Rule

Mainnet can be used only for read-only proof generation.

This Skill must not perform write operations on any network.
