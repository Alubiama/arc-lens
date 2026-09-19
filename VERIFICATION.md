# Verification — 2026-09-19

## Confirmed locally

- `node --test test/engine.test.mjs`: 12/12 pass on Node 24.18.0.
- Official public RPC returned `0x13b2` (5042).
- The browser fetched the documented mainnet example directly through RPC with no wallet/API key. UI: success, 8 canonical movements, 4 ERC-20 logs, 0.059403855 USDC fee. The fee agrees with the public Blockscout transaction detail.
- A captured example is separately labelled `CAPTURED SNAPSHOT`; it does not masquerade as a live RPC result.
- Empty hash input produced the visible validation message and focused the input.
- Mobile viewport 390×844: captured result rendered; document width was 390 (no horizontal overflow).
- Raw receipt and JSON download controls are implemented. Full cross-browser coverage and independent security review have not been performed.

## AI-assisted implementation review

DeepSeek through a bounded Hermes worker produced the initial parser and HTML/CSS fragments. Both coding runs hit the iteration limit and were **not** accepted as complete. The principal retained useful portions, completed the interface, and corrected reverted-receipt handling, malformed recognized events, address-topic padding, missing logs, exact data-word size and safe log-index range. Tests were written and executed independently after those corrections.

Public-source research and application drafting were also delegated. A worker's assertion that documented technical behavior proves user demand was rejected: no customer research or adoption evidence is claimed.

## Boundary

The app reads public Arc mainnet data; it does not deploy a smart contract. Passing these checks does not establish grant eligibility, selection, exhaustive transaction coverage, customer demand, or a financial/security audit.

## Visual update — 2026-09-19

Inspected the desktop interface at 1280 px and the captured-result screen at 390 px in the Codex browser. Mobile document width equals viewport width (390 px); the captured example renders 8 canonical movements and fee 0.059403855 USDC. This update changes presentation and local font assets only.
