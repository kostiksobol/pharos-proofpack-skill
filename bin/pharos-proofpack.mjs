#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NETWORKS_PATH = path.join(ROOT_DIR, "assets", "networks.json");

function fail(message, code = 1) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(code);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: [] };

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];

      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(token);
    }
  }

  return { command, args };
}

function requireArg(args, key) {
  const value = args[key];

  if (value === undefined || value === true || value === "") {
    throw new Error(`Missing required argument --${key}`);
  }

  return value;
}

function isHex(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

function assertAddress(address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Invalid address: ${address}`);
  }

  return address;
}

function assertHash(hash, label = "hash") {
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(`Invalid ${label}: ${hash}`);
  }

  return hash;
}

function normalizeBlockTag(value) {
  if (!value || value === "latest") return "latest";

  if (value === "earliest" || value === "pending" || value === "safe" || value === "finalized") {
    return value;
  }

  if (/^[0-9]+$/.test(value)) {
    return `0x${BigInt(value).toString(16)}`;
  }

  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return value;
  }

  throw new Error(`Invalid block tag: ${value}`);
}

function padStorageSlot(slot) {
  if (!isHex(slot)) {
    throw new Error(`Invalid storage slot: ${slot}`);
  }

  const body = slot.slice(2);

  if (body.length > 64) {
    throw new Error(`Storage slot too long: ${slot}`);
  }

  return `0x${body.padStart(64, "0")}`;
}

function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function formatUnits(raw, decimals = 18) {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;

  if (fraction === 0n) return whole.toString();

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionText}`;
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function resolveNetwork(nameOrAlias, overrideRpcUrl) {
  const config = await readJson(NETWORKS_PATH);
  const requested = nameOrAlias || config.defaultNetwork;

  const network = config.networks.find((item) => {
    if (item.name === requested) return true;
    return Array.isArray(item.aliases) && item.aliases.includes(requested);
  });

  if (!network) {
    throw new Error(`Unsupported network: ${requested}`);
  }

  return {
    ...network,
    rpcUrl: overrideRpcUrl || network.rpcUrl
  };
}

let rpcId = 1;

async function rpc(network, method, params) {
  const response = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpcId++,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP error ${response.status} for ${method}`);
  }

  const json = await response.json();

  if (json.error) {
    const message = json.error.message || JSON.stringify(json.error);
    throw new Error(`RPC error for ${method}: ${message}`);
  }

  return json.result;
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (value && typeof value === "object") {
    const out = {};

    for (const key of Object.keys(value).sort()) {
      if (key === "packHash") continue;
      out[key] = sortForCanonicalJson(value[key]);
    }

    return out;
  }

  return value;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalHash(value) {
  const canonical = JSON.stringify(sortForCanonicalJson(value));
  return `sha256:${sha256Hex(canonical)}`;
}

function compactRpcProof(rawProof) {
  if (!rawProof) return null;

  const stableJson = JSON.stringify(sortForCanonicalJson(rawProof));
  const accountProof = Array.isArray(rawProof.accountProof) ? rawProof.accountProof : [];
  const storageProof = Array.isArray(rawProof.storageProof) ? rawProof.storageProof : [];

  const storageProofSummary = storageProof.map((item) => {
    const proof = Array.isArray(item.proof) ? item.proof : [];
    const siblingLeftmostLeafProofs = Array.isArray(item.siblingLeftmostLeafProofs)
      ? item.siblingLeftmostLeafProofs
      : [];

    return {
      key: item.key ?? null,
      value: item.value ?? null,
      isExist: typeof item.isExist === "boolean" ? item.isExist : null,
      proofNodeCount: proof.length,
      proofHash: `sha256:${sha256Hex(JSON.stringify(sortForCanonicalJson(proof)))}`,
      siblingLeftmostLeafProofCount: siblingLeftmostLeafProofs.length,
      siblingLeftmostLeafProofHash: `sha256:${sha256Hex(JSON.stringify(sortForCanonicalJson(siblingLeftmostLeafProofs)))}`
    };
  });

  return {
    rawIncluded: false,
    rawHash: `sha256:${sha256Hex(stableJson)}`,
    address: rawProof.address ?? null,
    balance: rawProof.balance ?? null,
    nonce: rawProof.nonce ?? null,
    codeHash: rawProof.codeHash ?? null,
    storageHash: rawProof.storageHash ?? null,
    isExist: typeof rawProof.isExist === "boolean" ? rawProof.isExist : null,
    accountProofNodeCount: accountProof.length,
    accountProofHash: `sha256:${sha256Hex(JSON.stringify(sortForCanonicalJson(accountProof)))}`,
    storageProofCount: storageProof.length,
    storageProof: storageProofSummary
  };
}

function maybeCompactProof(rawProof, args) {
  if (args["include-raw-proof"]) {
    return rawProof;
  }

  return compactRpcProof(rawProof);
}

function basePack({ network, command, claim, evidence, conclusion }) {
  const pack = {
    proofpackVersion: "0.1.0",
    tool: "pharos-proofpack-skill",
    generatedAt: new Date().toISOString(),
    network: {
      name: network.name,
      chainId: network.chainId,
      rpcUrl: network.rpcUrl,
      explorerUrl: network.explorerUrl,
      nativeToken: network.nativeToken
    },
    command,
    claim,
    evidence,
    conclusion
  };

  return {
    ...pack,
    packHash: canonicalHash(pack)
  };
}

async function maybeWriteOutput(args, value) {
  if (args.out && args.out !== true) {
    await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
    await fs.writeFile(args.out, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  printJson(value);
}

async function commandProveChain(args) {
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const chainIdHex = await rpc(network, "eth_chainId", []);
  const blockNumberHex = await rpc(network, "eth_blockNumber", []);

  const observedChainId = Number(hexToBigInt(chainIdHex));
  const expectedChainId = network.chainId;
  const verified = observedChainId === expectedChainId;

  return basePack({
    network,
    command: "prove-chain",
    claim: {
      type: "chain_identity",
      expectedChainId
    },
    evidence: {
      rpcChainIdHex: chainIdHex,
      rpcChainIdDecimal: observedChainId,
      latestBlockNumberHex: blockNumberHex,
      latestBlockNumberDecimal: hexToBigInt(blockNumberHex).toString()
    },
    conclusion: {
      verified,
      summary: verified
        ? `RPC endpoint matches ${network.name} chainId ${expectedChainId}.`
        : `RPC endpoint returned chainId ${observedChainId}, expected ${expectedChainId}.`
    }
  });
}

async function commandProveTx(args) {
  const txHash = assertHash(requireArg(args, "tx"), "transaction hash");
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const tx = await rpc(network, "eth_getTransactionByHash", [txHash]);
  const receipt = await rpc(network, "eth_getTransactionReceipt", [txHash]);

  let block = null;

  if (receipt && receipt.blockNumber) {
    block = await rpc(network, "eth_getBlockByNumber", [receipt.blockNumber, false]);
  }

  const exists = tx !== null;
  const mined = receipt !== null;
  const succeeded = mined && receipt.status === "0x1";
  const failed = mined && receipt.status === "0x0";

  let summary;

  if (!exists) {
    summary = "Transaction was not found on this network.";
  } else if (!mined) {
    summary = "Transaction exists but has no receipt yet; it may be pending.";
  } else if (succeeded) {
    summary = `Transaction succeeded in block ${hexToBigInt(receipt.blockNumber).toString()}.`;
  } else if (failed) {
    summary = `Transaction failed in block ${hexToBigInt(receipt.blockNumber).toString()}.`;
  } else {
    summary = "Transaction receipt exists but status is unknown.";
  }

  return basePack({
    network,
    command: "prove-tx",
    claim: {
      type: "tx_succeeded",
      txHash
    },
    evidence: {
      transaction: tx,
      receipt,
      block
    },
    conclusion: {
      verified: succeeded,
      exists,
      mined,
      status: receipt ? receipt.status : null,
      summary
    }
  });
}

async function commandProveContract(args) {
  const address = assertAddress(requireArg(args, "address"));
  const blockTag = normalizeBlockTag(args.block);
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const code = await rpc(network, "eth_getCode", [address, blockTag]);

  let accountProof = null;
  let accountProofError = null;

  try {
    accountProof = await rpc(network, "eth_getProof", [address, [], blockTag]);
  } catch (error) {
    accountProofError = error.message;
  }

  const isContract = code !== "0x";
  const bytecodeSizeBytes = isContract ? (code.length - 2) / 2 : 0;

  return basePack({
    network,
    command: "prove-contract",
    claim: {
      type: "contract_exists",
      address,
      block: blockTag
    },
    evidence: {
      address,
      block: blockTag,
      code,
      codeHash: `sha256:${sha256Hex(code)}`,
      bytecodeSizeBytes,
      accountProof: maybeCompactProof(accountProof, args),
      accountProofError
    },
    conclusion: {
      verified: isContract,
      isContract,
      summary: isContract
        ? `Address contains ${bytecodeSizeBytes} bytes of bytecode.`
        : "Address has no contract bytecode at the selected block."
    }
  });
}

async function commandProveAccount(args) {
  const address = assertAddress(requireArg(args, "address"));
  const blockTag = normalizeBlockTag(args.block);
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const [balanceHex, nonceHex, code] = await Promise.all([
    rpc(network, "eth_getBalance", [address, blockTag]),
    rpc(network, "eth_getTransactionCount", [address, blockTag]),
    rpc(network, "eth_getCode", [address, blockTag])
  ]);

  let accountProof = null;
  let accountProofError = null;

  try {
    accountProof = await rpc(network, "eth_getProof", [address, [], blockTag]);
  } catch (error) {
    accountProofError = error.message;
  }

  const balanceWei = hexToBigInt(balanceHex);
  const nonce = hexToBigInt(nonceHex);
  const isContract = code !== "0x";

  return basePack({
    network,
    command: "prove-account",
    claim: {
      type: "account_state",
      address,
      block: blockTag
    },
    evidence: {
      address,
      block: blockTag,
      balanceHex,
      balanceWei: balanceWei.toString(),
      balanceNative: formatUnits(balanceWei, 18),
      nonceHex,
      nonceDecimal: nonce.toString(),
      code,
      codeHash: `sha256:${sha256Hex(code)}`,
      accountProof: maybeCompactProof(accountProof, args),
      accountProofError
    },
    conclusion: {
      verified: true,
      isContract,
      summary: `Account state collected: balance ${formatUnits(balanceWei, 18)} ${network.nativeToken}, nonce ${nonce.toString()}.`
    }
  });
}

async function commandProveStorage(args) {
  const address = assertAddress(requireArg(args, "address"));
  const slot = padStorageSlot(requireArg(args, "slot"));
  const blockTag = normalizeBlockTag(args.block);
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const value = await rpc(network, "eth_getStorageAt", [address, slot, blockTag]);

  let accountProof = null;
  let accountProofError = null;

  try {
    accountProof = await rpc(network, "eth_getProof", [address, [slot], blockTag]);
  } catch (error) {
    accountProofError = error.message;
  }

  return basePack({
    network,
    command: "prove-storage",
    claim: {
      type: "storage_value",
      address,
      slot,
      block: blockTag
    },
    evidence: {
      address,
      slot,
      block: blockTag,
      value,
      valueHash: `sha256:${sha256Hex(value)}`,
      accountProof: maybeCompactProof(accountProof, args),
      accountProofError
    },
    conclusion: {
      verified: true,
      summary: `Storage value collected for slot ${slot}.`
    }
  });
}

async function commandProveCall(args) {
  const to = assertAddress(requireArg(args, "to"));
  const data = requireArg(args, "data");

  if (!isHex(data)) {
    throw new Error(`Invalid calldata: ${data}`);
  }

  const blockTag = normalizeBlockTag(args.block);
  const network = await resolveNetwork(args.network, args["rpc-url"]);

  const tx = { to, data };

  if (args.from && args.from !== true) {
    tx.from = assertAddress(args.from);
  }

  if (args["value-wei"] && args["value-wei"] !== true) {
    const valueWei = BigInt(args["value-wei"]);

    if (valueWei < 0n) {
      throw new Error("--value-wei cannot be negative");
    }

    tx.value = `0x${valueWei.toString(16)}`;
  }

  const code = await rpc(network, "eth_getCode", [to, blockTag]);
  const result = await rpc(network, "eth_call", [tx, blockTag]);

  return basePack({
    network,
    command: "prove-call",
    claim: {
      type: "call_result",
      to,
      data,
      block: blockTag
    },
    evidence: {
      call: tx,
      block: blockTag,
      targetCodeExists: code !== "0x",
      targetCodeHash: `sha256:${sha256Hex(code)}`,
      result,
      resultHash: `sha256:${sha256Hex(result)}`
    },
    conclusion: {
      verified: true,
      targetCodeExists: code !== "0x",
      warnings: code === "0x"
        ? ["Target address has no bytecode; this proves an eth_call result, not a contract interaction."]
        : [],
      summary: `eth_call returned ${result.length >= 18 ? `${result.slice(0, 18)}...` : result}.`
    }
  });
}

async function commandVerifyPack(args) {
  const file = requireArg(args, "file");
  const pack = await readJson(path.resolve(file));

  const expectedHash = canonicalHash(pack);
  const hashMatches = pack.packHash === expectedHash;

  const checks = [
    {
      name: "packHash",
      passed: hashMatches,
      expected: expectedHash,
      actual: pack.packHash || null
    }
  ];

  if (!pack.proofpackVersion) {
    checks.push({ name: "proofpackVersion", passed: false, reason: "Missing proofpackVersion" });
  }

  if (!pack.network || typeof pack.network.chainId !== "number") {
    checks.push({ name: "network", passed: false, reason: "Missing network.chainId" });
  }

  if (!pack.claim || !pack.claim.type) {
    checks.push({ name: "claim", passed: false, reason: "Missing claim.type" });
  }

  if (!pack.evidence) {
    checks.push({ name: "evidence", passed: false, reason: "Missing evidence" });
  }

  if (!pack.conclusion) {
    checks.push({ name: "conclusion", passed: false, reason: "Missing conclusion" });
  }

  if (pack.claim?.type === "tx_succeeded") {
    const status = pack.evidence?.receipt?.status || null;

    checks.push({
      name: "tx_succeeded_consistency",
      passed: status === "0x1" ? pack.conclusion?.verified === true : pack.conclusion?.verified === false,
      receiptStatus: status,
      conclusionVerified: pack.conclusion?.verified
    });
  }

  if (pack.claim?.type === "contract_exists") {
    const code = pack.evidence?.code;

    checks.push({
      name: "contract_exists_consistency",
      passed: code && code !== "0x" ? pack.conclusion?.verified === true : pack.conclusion?.verified === false,
      hasCode: Boolean(code && code !== "0x"),
      conclusionVerified: pack.conclusion?.verified
    });
  }

  const ok = checks.every((check) => check.passed === true);

  return {
    ok,
    file,
    expectedHash,
    actualHash: pack.packHash || null,
    checks
  };
}

function help() {
  return {
    name: "pharos-proofpack-skill",
    usage: [
      "node bin/pharos-proofpack.mjs prove-chain --network atlantic-testnet",
      "node bin/pharos-proofpack.mjs prove-tx --network atlantic-testnet --tx 0x...",
      "node bin/pharos-proofpack.mjs prove-contract --network atlantic-testnet --address 0x...",
      "node bin/pharos-proofpack.mjs prove-account --network atlantic-testnet --address 0x...",
      "node bin/pharos-proofpack.mjs prove-storage --network atlantic-testnet --address 0x... --slot 0x0",
      "node bin/pharos-proofpack.mjs prove-call --network atlantic-testnet --to 0x... --data 0x...",
      "node bin/pharos-proofpack.mjs verify-pack --file proofpack.json"
    ],
    commonOptions: {
      "--network": "atlantic-testnet | atlantic | mainnet",
      "--rpc-url": "optional RPC override",
      "--block": "latest | decimal block | hex block",
      "--out": "optional output file path",
      "--include-raw-proof": "include full raw eth_getProof response instead of compact proof hashes"
    }
  };
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printJson(help());
    return;
  }

  const commandMap = {
    "prove-chain": commandProveChain,
    "prove-tx": commandProveTx,
    "prove-contract": commandProveContract,
    "prove-account": commandProveAccount,
    "prove-storage": commandProveStorage,
    "prove-call": commandProveCall,
    "verify-pack": commandVerifyPack
  };

  const handler = commandMap[command];

  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await handler(args);
  await maybeWriteOutput(args, result);
}

main().catch((error) => {
  fail(error.message);
});
