// Arc Lens - public read-only transaction explainer. No dependencies, no network.

export const SYSTEM_EMITTER = '0xfffffffffffffffffffffffffffffffffffffffe';
export const USDC = '0x3600000000000000000000000000000000000000';
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const MAX_U256 = (1n << 256n) - 1n;

// --- strict quantity / hex helpers -------------------------------------------------

function isHex(s) {
  return typeof s === 'string' && /^0x[0-9a-fA-F]*$/.test(s);
}

// RPC quantities have no leading zero; an odd number of nibbles is valid.
function parseQuantity(v, field) {
  if (typeof v !== 'string' || !/^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(v)) {
    throw new Error(`Invalid ${field}: expected strict 0x quantity`);
  }
  return BigInt(v);
}

function parseTopic(t, field) {
  if (!isHex(t) || t.length !== 66) {
    throw new Error(`Invalid ${field}: expected canonical 32-byte topic`);
  }
  return t.toLowerCase();
}

function topicToAddress(topic) {
  if (!/^0x0{24}/.test(topic)) throw new Error('Noncanonical address topic padding');
  // last 20 bytes of 32-byte topic
  return '0x' + topic.slice(2).slice(24);
}

// --- public API --------------------------------------------------------------------

export function formatUnits(valueBigInt, decimals = 18) {
  if (typeof valueBigInt !== 'bigint') throw new Error('formatUnits: value must be bigint');
  if (valueBigInt < 0n) throw new Error('formatUnits: negative amounts are not representable');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('formatUnits: invalid decimals');
  const d = BigInt(decimals);
  const scale = 10n ** d;
  const whole = valueBigInt / scale;
  let frac = (valueBigInt % scale).toString().padStart(decimals, '0');
  frac = frac.replace(/0+$/, '');
  return frac.length ? `${whole}.${frac}` : whole.toString();
}

function formatSignedUnits(valueBigInt) {
  if (valueBigInt === 0n) return '0';
  return `${valueBigInt > 0n ? '+' : '-'}${formatUnits(valueBigInt > 0n ? valueBigInt : -valueBigInt)}`;
}

export function summarizeMovementEffects(movements) {
  if (!Array.isArray(movements)) throw new Error('summarizeMovementEffects: movements must be an array');
  const accounts = new Map();
  let mintedRaw = 0n;
  let burnedRaw = 0n;

  function account(address) {
    if (!accounts.has(address)) accounts.set(address, {address, inflow: 0n, outflow: 0n, movementCount: 0});
    return accounts.get(address);
  }

  for (const movement of movements) {
    if (!movement || typeof movement !== 'object') throw new Error('summarizeMovementEffects: invalid movement');
    const from = normalizeAddress(movement.from, 'movement.from');
    const to = normalizeAddress(movement.to, 'movement.to');
    if (typeof movement.rawAmount !== 'string' || !/^(0|[1-9][0-9]*)$/.test(movement.rawAmount)) {
      throw new Error('summarizeMovementEffects: invalid rawAmount');
    }
    const amount = BigInt(movement.rawAmount);
    if (from === ZERO_ADDRESS) mintedRaw += amount;
    else { const entry = account(from); entry.outflow += amount; entry.movementCount++; }
    if (to === ZERO_ADDRESS) burnedRaw += amount;
    else { const entry = account(to); entry.inflow += amount; entry.movementCount++; }
  }

  const roleOrder = {source: 0, recipient: 1, transit: 2};
  const participants = [...accounts.values()].map(entry => {
    const net = entry.inflow - entry.outflow;
    const role = net < 0n ? 'source' : net > 0n ? 'recipient' : 'transit';
    return {
      address: entry.address,
      role,
      movementCount: entry.movementCount,
      inflowRaw: entry.inflow.toString(),
      outflowRaw: entry.outflow.toString(),
      netRaw: net.toString(),
      inflow: formatUnits(entry.inflow),
      outflow: formatUnits(entry.outflow),
      net: formatSignedUnits(net),
    };
  }).sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.address.localeCompare(b.address));

  const supplyChange = mintedRaw - burnedRaw;
  return {
    participants,
    sourceCount: participants.filter(item => item.role === 'source').length,
    recipientCount: participants.filter(item => item.role === 'recipient').length,
    transitCount: participants.filter(item => item.role === 'transit').length,
    supply: {
      mintedRaw: mintedRaw.toString(),
      burnedRaw: burnedRaw.toString(),
      netRaw: supplyChange.toString(),
      minted: formatUnits(mintedRaw),
      burned: formatUnits(burnedRaw),
      net: formatSignedUnits(supplyChange),
    },
  };
}

export function analyzeReceipt(receipt) {
  if (receipt === null || receipt === undefined) {
    throw new Error('analyzeReceipt: receipt is required (got null/undefined)');
  }
  if (typeof receipt !== 'object') {
    throw new Error('analyzeReceipt: receipt must be an object');
  }

  const hash = validateHash(receipt.transactionHash ?? receipt.hash);
  const status = validateStatus(receipt.status);
  const blockNumber = parseQuantity(receipt.blockNumber, 'blockNumber').toString();

  // fee raw = gasUsed * effectiveGasPrice (native18)
  const gasUsed = parseQuantity(receipt.gasUsed, 'gasUsed');
  const effGasPrice = parseQuantity(receipt.effectiveGasPrice, 'effectiveGasPrice');
  const feeRaw = (gasUsed * effGasPrice).toString();
  const fee = formatUnits(gasUsed * effGasPrice, 18);

  const logs = receipt.logs;
  if (!Array.isArray(logs)) {
    throw new Error('analyzeReceipt: receipt logs are missing or invalid');
  }

  const movements = [];
  const warnings = [];
  const seenIndices = new Set();
  let systemLogCount = 0;
  let erc20LogCount = 0;

  for (const log of logs ?? []) {
    if (log === null || typeof log !== 'object') {
      throw new Error('analyzeReceipt: each log must be an object');
    }
    if (log.removed === true) {
      throw new Error('analyzeReceipt: removed logs are not valid evidence');
    }
    const logIndex = validateLogIndex(log.logIndex);
    if (seenIndices.has(logIndex)) {
      throw new Error(`analyzeReceipt: duplicate logIndex ${logIndex}`);
    }

    const emitter = normalizeAddress(log.address, 'log.address');
    const topics = log.topics;
    if (!Array.isArray(topics)) {
      throw new Error('analyzeReceipt: log.topics must be an array');
    }
    const parsedTopics = topics.map((t, i) => parseTopic(t, `topics[${i}]`));
    const topic0 = parsedTopics[0];
    if ((emitter === SYSTEM_EMITTER || emitter === USDC) && topic0 === TRANSFER_TOPIC && parsedTopics.length !== 3) {
      throw new Error('Malformed USDC Transfer topics');
    }
    const isTransfer = parsedTopics.length === 3 && topic0 === TRANSFER_TOPIC;

    if (!isTransfer) {
      seenIndices.add(logIndex);
      continue; // not a recognized Transfer event
    }

    if (emitter !== SYSTEM_EMITTER && emitter !== USDC) {
      seenIndices.add(logIndex);
      continue;
    }
    const data = requireData(log.data);
    topicToAddress(parsedTopics[1]);
    topicToAddress(parsedTopics[2]);

    if (emitter === SYSTEM_EMITTER) {
      seenIndices.add(logIndex);
      systemLogCount++;
      const from = topicToAddress(parsedTopics[1]);
      const to = topicToAddress(parsedTopics[2]);
      const raw = parseUint256(data, 'system transfer data');
      const kind = from === ZERO_ADDRESS ? 'mint'
        : to === ZERO_ADDRESS ? 'burn' : 'transfer';
      movements.push({
        from, to,
        amount: formatUnits(raw, 18),
        rawAmount: raw.toString(),
        logIndex,
        kind,
      });
    } else if (emitter === USDC) {
      seenIndices.add(logIndex);
      erc20LogCount++;
    } else {
      seenIndices.add(logIndex); // unknown emitter ignored (not money)
    }
  }

  // Alternate 6-decimal evidence exists but no canonical system events: warn, don't invent.
  if (erc20LogCount > 0 && systemLogCount === 0) {
    warnings.push(
      'ERC20 transfer events present without canonical system-emitter events; ' +
        'event evidence may be incomplete.'
    );
  }

  const canonicalMovements = status === 'reverted' ? [] : movements.sort((a,b) => a.logIndex-b.logIndex);
  return {
    hash,
    status,
    blockNumber,
    fee,
    feeRaw,
    movements: canonicalMovements,
    netEffects: summarizeMovementEffects(canonicalMovements),
    systemLogCount,
    erc20LogCount,
    warnings: status === 'reverted' && logs.length ? [...warnings, 'Reverted receipt contains logs: inconsistent RPC evidence; no movements counted.'] : warnings,
  };
}

export function assessReceiptHealth(report, context = {}) {
  if (!report || typeof report !== 'object') throw new Error('assessReceiptHealth: report is required');
  const chainId = context.chainId;
  const sourceMode = context.sourceMode;
  const checks = [];
  const add = (id, label, status, detail, observed, source) => checks.push({id, label, status, detail, observed, source});

  add(
    'arc-mainnet', 'Arc mainnet', chainId === 5042 ? 'pass' : 'warn',
    chainId === 5042 ? 'The source was verified as Arc chain 5042.' : 'Arc chain 5042 was not verified; no mainnet claim should be made.',
    chainId ?? null, 'eth_chainId or captured fixture chainId'
  );
  add(
    'execution', 'Execution completed', report.status === 'success' ? 'pass' : 'warn',
    report.status === 'success' ? 'The receipt status is successful.' : 'The transaction reverted; no completed movements are reported.',
    report.status, 'receipt.status'
  );
  add(
    'canonical-stream', 'Canonical USDC stream',
    report.status === 'reverted' ? 'na' : report.systemLogCount > 0 ? 'pass' : 'warn',
    report.status === 'reverted' ? 'Not applicable to a reverted execution.' : report.systemLogCount > 0 ? `${report.systemLogCount} system-emitter Transfer event${report.systemLogCount === 1 ? '' : 's'} decoded at 18 decimals.` : 'No canonical system-emitter Transfer event was found in this receipt.',
    report.systemLogCount, 'receipt.logs[].address + topics + data'
  );
  add(
    'alternative-stream', 'Alternative stream separated',
    report.erc20LogCount === 0 ? 'na' : report.systemLogCount > 0 ? 'pass' : 'warn',
    report.erc20LogCount === 0 ? 'No ERC-20 USDC Transfer records were present.' : report.systemLogCount > 0 ? `${report.erc20LogCount} ERC-20 record${report.erc20LogCount === 1 ? '' : 's'} kept as evidence and excluded from canonical movement totals.` : 'ERC-20 records exist without canonical system events; evidence may be incomplete.',
    report.erc20LogCount, 'receipt.logs[].address'
  );
  add(
    'fee-separated', 'Fee kept separate', 'pass',
    'Gas fee was calculated exactly and excluded from participant net effects.',
    `${report.fee} USDC`, 'receipt.gasUsed × receipt.effectiveGasPrice'
  );
  add(
    'evidence-source', 'Evidence source identified',
    sourceMode === 'live' || sourceMode === 'captured' ? 'pass' : 'warn',
    sourceMode === 'live' ? 'Live RPC retrieval and a transaction-specific share URL identify the evidence.' : sourceMode === 'captured' ? 'The result is explicitly labelled as a captured snapshot.' : 'The evidence source mode was not identified.',
    sourceMode ?? null, 'analysis source metadata'
  );

  return {
    verdict: checks.some(check => check.status === 'warn') ? 'review' : 'pass',
    counts: {
      pass: checks.filter(check => check.status === 'pass').length,
      warn: checks.filter(check => check.status === 'warn').length,
      na: checks.filter(check => check.status === 'na').length,
    },
    checks,
  };
}

// --- validation helpers ------------------------------------------------------------

function validateHash(h) {
  if (typeof h !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(h)) {
    throw new Error('analyzeReceipt: invalid transactionHash (expected 0x-prefixed 32 bytes)');
  }
  return h.toLowerCase();
}

function validateStatus(s) {
  const n = parseQuantity(s, 'status');
  if (n === 1n) return 'success';
  if (n === 0n) return 'reverted';
  throw new Error('analyzeReceipt: invalid status (expected 0x0 or 0x1)');
}

function validateLogIndex(i) {
  const n = parseQuantity(i, 'logIndex');
  if (typeof n !== 'number' && typeof n !== 'bigint') {
    throw new Error('analyzeReceipt: invalid logIndex');
  }
  if (BigInt(n) < 0n || BigInt(n) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('analyzeReceipt: logIndex out of range');
  }
  return Number(n); // logIndex must be a JS number in output
}

function normalizeAddress(a, field) {
  if (typeof a !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(a)) {
    throw new Error(`analyzeReceipt: invalid ${field} (expected 0x address)`);
  }
  return a.toLowerCase();
}

function requireData(d) {
  if (!isHex(d) || d.length !== 66) throw new Error('analyzeReceipt: invalid log.data (expected 32-byte word)');
  return d;
}

function parseUint256(data, field) {
  const hex = data.slice(2);
  if (hex.length === 0 || hex.length > 64) {
    throw new Error(`analyzeReceipt: invalid ${field} (uint256 word required)`);
  }
  return BigInt('0x' + hex);
}
