---
name: onchain
description: On-chain wallet and token forensics to find hidden alpha and connections. Use when asked to "analyze this wallet", "trace this token", "who is behind X", "find connections between wallets", "investigate a token launch", "is this token safe", "money trail", "dev wallet analysis", "whale cluster analysis", or any request to discover links, funders, dev wallets, or hidden patterns on Ethereum, ETH-adjacent chains (L2s, Robinhood Chain, Base, etc.), or Solana. Produces a structured risk/alpha report with verification paths.
---

# onchain-alpha — Wallet & Token Forensics

Distilled from the BAG token investigation (Robinhood Chain + Ethereum). A procedural
playbook for turning raw chain data into a structured report: who owns what, how it's
connected, what the dev is doing, and where the money flows.

## Core principles

1. **Trace before you judge.** Read existing reports/context first, then pull live data. Never analyze from memory of a prior session - the chain moved.
2. **Verify everything at the boundary.** Pull via RPC (`cast`) and explorer APIs (`blockscout`), cross-check claims. A "fact" from a stale report is a hypothesis.
3. **The dev's fingerprint is patterns, not messages.** Vanity suffix wallet families, dust/heartbeat txs, daily recurring payments, launch-day spending - these are how operators actually communicate on-chain.
4. **Distinguish shared infra from dev-owned.** Public executors/payment services (many callers) vs private contracts (single caller family). This one check prevents false attribution.
5. **Every report ends with verification paths** - the block-explorer clicks that prove or disprove each claim, and what would flip the verdict.

## Phase 0 - Context recon (5 min)

- Read any existing analysis files in the project dir (`*analysis*.md`, `*report*.md`).
- Extract: token CA, chain, deployer, factory, known wallets, open questions.
- Record the date - every subsequent snapshot is a delta vs this baseline.

## Phase 1 - Environment setup

1. **Find the RPC**: `curl -s https://chainid.network/chains.json | jq '.[] | select(.chainId==<ID>) | {rpc, explorers}'` - official chainlist is the fastest RPC/explorer discovery. (Trick: if you know the explorer, `robinhoodchain.blockscout.com` → chainlist finds `rpc.mainnet.chain.robinhood.com`.)
2. **Verify**: `cast chain-id --rpc-url <RPC>` must return the expected chain ID.
3. **Explorer API base**: blockscout chain = `https://<explorer>/api/v2` (Ethereum: `https://eth.blockscout.com/api/v2`). Endpoints used constantly:
   - `/tokens/{ca}` - token info (name, symbol, holders, supply)
   - `/tokens/{ca}/holders` - holders (paginate with `next_page_params`)
   - `/tokens/{ca}/transfers` - transfer count
   - `/addresses/{a}` - address summary (is_contract, coin_balance, tags)
   - `/addresses/{a}/transactions` - tx list (paginate)
   - `/transactions/{hash}` - single tx incl. decoded input
4. **Selector decoding**: `curl -s "https://www.4byte.directory/api/v1/signatures/?hex_signature=0x<sel>"`. Not in db? Decode args manually (ABI), or check the string args directly - strings are often the message.

## Phase 2 - Token state snapshot

- **Basics**: name, symbol, decimals, total supply, holders, transfers count.
- **Supply integrity**: `totalSupply()` must equal the initial supply (1e27 etc.). Any delta = mints. Check for `owner()`, mint selector in bytecode, EIP-1967 upgrade slot (empty = not upgradeable), pause.
- **Concentration**: paginate ALL holders, keep balance order (dedupe with `awk '!seen[$1]++'` - do NOT sort by address). Compute: pool %, burn %, top-10/20/50 EOA %, EOA vs contract split, largest EOA.
- **LP lock**: find the pool address (top holder / launcher path), position NFT id, `ownerOf(id)` on the PositionManager. Lock = NFT in a verified lock contract (Uniswap FeeSplitter, lockers) with no transfer path. Check `beneficiaryVault()` on launcher strategies - who earns the fees.

## Phase 3 - Dev wallet set enumeration

Build the wallet family:
- **Deployer**: from creation tx / factory `TokenDeployed` event / multicall `from`.
- **Treasury/funder**: who funded the deployer? (Ethereum-side first funder, often drips 1-2 ETH every few days - a drip cadence is a fingerprint.)
- **Vanity clones**: scan addresses ending in the deployer's distinctive suffix (e.g. `...3538`). These are cheap to generate and devs use them as a family. Any tx to/from the deployer or treasury from a same-suffix address = member of the family.
- **Satellites**: bridge relayers, drip recipients, reward vaults.
- For each: tx count, balances (native + token), first/last activity. Dormant ≠ dead - note it.

## Phase 4 - Graph / cluster analysis

- **Top holders**: classify each - DEX pool, exchange custody engine (Settler-type), router, EOA. Hubs = contracts with high degree centrality.
- **Distribution path**: how did supply flow from launcher → pool → holders? (factory → strategy → PositionManager → PoolManager is the Pools.trade-style path.)
- **Organic vs controlled**: sample top-20 EOA inbound transfers - what share came via pool/routers (organic), via exchange (app customers), via EOA-to-EOA (OTC)? Sybil fan-out from one controller = controlled. One shared funding origin (exchange hot wallet) = infrastructure, not a dev ring.
- **Intermediary ratio**: hubs/contracts vs holder count. ~2% = normal for exchange-distributed tokens; proxy-chain pyramids run much higher.
- **Key question**: does the main cluster connect to the dev set? Check transfers BOTH directions, both BAG and native. Zero transfers both ways = dev is an isolated leaf.

## Phase 5 - Behavioral indicators (where the alpha hides)

| Indicator | Signal |
|---|---|
| Fresh wallets | Only discriminating if wallet age varies - all-fresh = token is young, not suspicious |
| Coordinated funding | Same origin funding multiple top holders = cluster. Exchange hot wallet = custody infra, not dev |
| Mixers/bridges | Check dev funding path for mixers; a bridge relayer touching the dev path is normal infra |
| Volume bots | Rapid same-pair ping-pong on fresh wallets; high transfer counts on EOA |
| Wash trades | Deployer buying its own token minutes after launch, selling back = micro-signal, self-neutralizing |
| **Dust/heartbeat beacons** | Rotating vanity-suffix wallets sending micro-amounts (1e9/1e7 wei) to the treasury, ~300-400/day, empty calldata. = operator keepalive. Check: who else dusts the target? If 100% from one suffix family, it's the dev's fingerprint. Wallets rotate - check for NEW clones spawned recently |
| **Recurring payments** | Daily same-amount USDC/ETH outflows = burn rate. Started at launch day = operation spend. Decode the payment contract selector + string args (often unix-timestamp request IDs, not messages) |
| Factory activity | Recent multicall deployments from other addresses = other operators on the same launcher, not necessarily the same dev |

## Phase 6 - On-chain "messages" from the dev

Memecoin devs speak through chain state, not socials:
- **Metadata**: name/symbol/URI changes (needs owner - absence of owner() means static). tokenURI may revert - fine.
- **Calldata strings**: decode tx inputs; strings are the closest thing to text messages. Timestamp-prefixed = request IDs, not messages.
- **New deployments**: factory's recent txs - same dev would need new txs on the launch chain; dormant dev set = no new messages.
- **Dust pattern** (see Phase 5): the most common live "message" is the keepalive beacon.
- Cross-check the OTHER chain: devs bridge ETH (Across etc.) from Ethereum to launch on ETH-adjacent chains. Ethereum side is where the operation actually runs.

## Phase 7 - Money trails

Follow the recurring outflow until it terminates:
1. Identify the payment contract (proxy? who created it? shared or single-sender?).
2. Decode `payment()` args: recipients + amounts + string. Split to multiple recipients = layered payout.
3. Recipient classification: EOA sweeper (forwards to one destination repeatedly) vs executor contract (private, unverified, high ETH balance, constant calls).
4. Trace the sweeper's outbound token transfers to final destination.
5. Note the total monthly burn: amount × frequency. Correlate start date with launch date.

## Phase 8 - Risk score + report

Score: LOW / MEDIUM / HIGH, driven by:
- Concentration (pool %, top-EOA %, dev holdings)
- LP lock status (code-locked = rug vector eliminated)
- Mint/owner/upgrade backdoors
- Fee extraction (creator % of fees)
- Behavioral flags (fresh, anonymous serial launcher, wash trade)

Report format (markdown, mirrors prior reports for diffability):
- Snapshot table (delta vs prior analysis: holders, pool %, concentration, supply)
- Wallet family table
- Findings: cluster connection verdict, dev activity, money trail
- Residual caveats + what would flip the verdict
- Verification paths (block explorer links/checks)

## Solana adaptation

Same playbook, different tools:
- **RPC**: Helius/mainnet public; **Explorer API**: Solscan (`https://api.solscan.io/v2/...` with token `token_holders`, `account/transactions`), or Helius enhanced endpoints.
- **Token**: SPL mint - check mint authority (can print) and freeze authority; Metaplex metadata (name/symbol/URI - the "message" lives in URI).
- **Holders**: Solscan token-holders; compute same concentration metrics.
- **Dev set**: creator (first account in mint tx), associated token accounts (ATA derivation from mint+owner - `getAssociatedTokenAddress`).
- **LP**: Raydium/Orca pool state (pool authority, LP mint, locked LP = burned or in lockers).
- **Vanity/dust**: base58 vanity suffixes exist but are rarer; dust/heartbeat patterns identical - check high-frequency micro-token/lamport transfers to a treasury.
- **Messages**: metadata URI updates (metadata authority), token extensions.

## Tool cheat sheet

- `cast call <addr> "fn()(ret)" --rpc-url <RPC>` - any read
- `cast code <addr> --rpc-url <RPC>` - contract? (blockscout `is_contract` can be wrong - verify)
- `cast sig 0x<sel>` / 4byte.directory - selector decode
- `curl` + `jq` + blockscout `/api/v2` - bulk history (always paginate; dedupe keeping balance order)
- Public ETH RPCs: `https://cloudflare-eth.com`, `https://ethereum.publicnode.com`, `https://eth.drpc.org` (llamarpc flakes - rotate)
- Robinhood Chain: `https://rpc.mainnet.chain.robinhood.com` (chain 4663), explorer `robinhoodchain.blockscout.com`
- Python one-liner for hex-timestamp decode: `int(h,16)` → `datetime.fromtimestamp`

## Output rule

Code/data first, then at most a few lines of interpretation. Every claim in the report must carry the tx hash or address it came from.
