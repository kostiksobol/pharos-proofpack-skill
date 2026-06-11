# Examples

## Prove chain

Command:

    node bin/pharos-proofpack.mjs prove-chain --network atlantic-testnet

Expected result:

    conclusion.verified = true

## Prove zero address is not a contract

Command:

    node bin/pharos-proofpack.mjs prove-contract \
      --network atlantic-testnet \
      --address 0x0000000000000000000000000000000000000000

Expected result:

    conclusion.verified = false

## Save proofpack

Command:

    mkdir -p proofpacks

    node bin/pharos-proofpack.mjs prove-chain \
      --network atlantic-testnet \
      --out proofpacks/chain-proof.json

## Verify proofpack

Command:

    node bin/pharos-proofpack.mjs verify-pack \
      --file proofpacks/chain-proof.json

Expected result:

    ok = true
