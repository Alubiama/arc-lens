# Arc mainnet validation cases

Captured from the public Arc mainnet RPC on 2026-09-19 and rechecked by the deterministic Arc Lens engine. These are public chain observations, not user testimonials or proof of exhaustive coverage.

| Case | Transaction | Verified receipt profile |
|---|---|---|
| Simple native USDC transfer | [`0x3c138b…c0fa3`](https://explorer.arc.io/tx/0x3c138bf5e5855e33bfd0a864bf291703747077aefeccd2f712a065575f3c0fa3) | 1 system event, 0 ERC-20 records |
| Direct ERC-20 interface transfer | [`0x308703…2af38`](https://explorer.arc.io/tx/0x308703f96bb8a6ba179b8d15b4c8c92f0179f64932fe7fd71c5668a38ce2af38) | 1 system event, 1 alternative ERC-20 record |
| Complex mixed-stream route | [`0xbcd881…88aa4`](https://explorer.arc.io/tx/0xbcd8818fa6d1fcf335417a5d32025331f88d2e51b578c997f379d0bcf6f88aa4) | 4 system events, 5 ERC-20 records, 2 zero-net transit addresses |
| Multi-recipient payout | [`0xec0815…cd07ec`](https://explorer.arc.io/tx/0xec0815ffe135eb703e657cd876f7848d0cca4422cef9473561318565a4cd07ec) | 6 system events, 6 ERC-20 records, 4 net recipients |
| System-only multi-hop | [`0x38176e…6abd69`](https://explorer.arc.io/tx/0x38176eb72a6ded86bb6e60e3c24a21ec6d3c59c0b63d3df9b230a5bdab6abd69) | 3 system events, 0 ERC-20 records, 2 zero-net transit addresses |

Each fixture stores the raw receipt, RPC source, capture date, chain ID and explorer URL. Tests independently derive counts from the receipt; the profile text is not used as an assertion source.
