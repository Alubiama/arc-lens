# Arc Lens

**See the movement. Skip the duplicate.** A small, read-only Arc mainnet USDC receipt debugger for payment integrations, indexers and transaction history.

Arc has two event streams for USDC. A transfer through the ERC-20 interface can appear twice: once in the native system stream (18 decimals), once in the ERC-20 stream (6 decimals). Arc Lens exposes that distinction instead of counting both as money moved.

## Run

No install, build, API key or wallet connection is needed.

```sh
python3 -m http.server 8768 --bind 127.0.0.1
# open http://127.0.0.1:8768
node --test test/engine.test.mjs
```

The browser connects directly to `https://rpc.mainnet.arc.io`, verifies chain ID `5042`, then fetches `eth_getTransactionReceipt`. The only RPC methods are read-only. There is no backend, signing, fund custody, analytics or local-storage tracking. RPC/hosting providers may have their own request logs.

## What to try

1. Click **Try mainnet example** for a current RPC retrieval of a known mined transaction.
2. The example has 8 system-emitter movements and 4 ERC-20 logs: 8 canonical movements, not 12. The fee is **0.059403855 USDC**, accounted for separately.
   The result renders this as a visible `12 event records → 8 canonical movements` check so the core failure mode is reproducible at a glance.
3. Inspect every from/to/amount/log index. Equal-value movements are preserved, not merged heuristically.
4. Review **Net USDC effects** to separate net sources and recipients from zero-net transit addresses. This summary is derived only from canonical movements; network fee remains separate.
5. Use **Follow the money**: select an address to highlight every canonical movement it touches; select it again, press Escape or use Clear to reset.
6. Copy a shareable `?tx=` URL or expand the raw receipt and download a JSON bundle containing the receipt, analysis, network and retrieval provenance.
7. Review the **Integration health check**: compact deterministic `PASS / WARN / N/A` rows expand to reveal their evidence source.
8. **Load captured example** works from a saved public mainnet receipt and has a stable `?sample=captured` URL. It is visibly labelled as a snapshot, never a live result.

Five additional public mainnet shapes are listed in [VALIDATION_CASES.md](VALIDATION_CASES.md) and linked directly from the interface.

Example: [public mainnet transaction](https://explorer.arc.io/tx/0xb147ec455818b74b6511e905abc6f56e15c189432f3c0e98b397108e6916d8e3).

## Semantics and limits

- System emitter: `0xfffffffffffffffffffffffffffffffffffffffe`, 18-decimal USDC.
- ERC-20 USDC: `0x3600000000000000000000000000000000000000`, 6-decimal alternative event view.
- Only canonical system-emitter `Transfer` logs become movements. ERC-20 logs are counted separately as evidence; the two streams are never summed. Zero/self-transfer edge cases can produce an ERC-20-only warning rather than an invented payment.
- Amounts and fees use `BigInt` with exact decimal formatting. Gas fee = `gasUsed × effectiveGasPrice`.
- Reverted transactions do not produce completed movements. Inconsistent/malformed RPC evidence fails or is explicitly warned about.
- This is not a trace debugger, full balance reconciliation, pricing service, security audit, sanctions checker or accounting/tax determination. It does not infer an economic purpose from transfers. Multiple transfers may be hops within the same operation.
- No contract is deployed by this application. It is static infrastructure that reads live Arc mainnet; an organizer has not independently confirmed its eligibility for a specific grant.
- Public RPC availability and CORS depend on the provider. Errors never silently turn into a snapshot or a claim of zero transfers.

## Evidence and tests

27 deterministic tests cover precision/dust, dual streams, repeated equal payments, reverts, malformed logs, duplicate indices, missing fields, mint/burn, health-check states, address-focus matching and eight captured public mainnet receipts. Fixtures carry their source and capture date. Passing fixtures is not proof that every possible transaction shape is supported.

## Sources

- [USDC system events](https://docs.arc.io/arc/references/usdc-system-events)
- [Wallet integration guidance](https://www.arc.io/blog/supporting-arc-in-wallets-one-balance-usdc-fees-and-complete-history)
- [Mainnet RPC parameters](https://docs.arc.io/arc/references/rpc-endpoints)

Independent project. Not affiliated with or endorsed by Circle or Arc. Built with AI assistance and independently reviewed; see [verification](VERIFICATION.md) for the actual test boundary.

## Visual styling

The interface adapts the visual language observed on [arc.io](https://www.arc.io/) on 2026-09-19: pale blue gradients, navy typography, thin orbital lines and black buttons. This is an independent design adaptation, not an official Arc brand certification. DM Sans and Space Grotesk are hosted locally; their OFL licenses are included in `assets/fonts/`.
