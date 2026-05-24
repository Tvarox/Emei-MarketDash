# Bugfix Requirements Document

## Introduction

The Emei Dashboard renders a "Live Settlement Ledger" backed by `useProtocolSimulation`. On initial page load, Next.js logs a hydration mismatch:

> A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up.

The diff shows that every row's `<a href="https://sepolia.mantlescan.xyz/tx/0x...">` URL differs between server and client. The reported source location is `src/components/SettlementLedger.tsx:144` (the `<a>` tag inside `LedgerRow`), but the data originates upstream in `src/hooks/useProtocolSimulation.ts`, where `INITIAL_INVOICES` is declared at module scope and each entry calls `generateTxHash()` (which uses `Math.random()`). Module evaluation runs once on the server and once on the client, so the two renders are seeded from independent random streams and produce different `txHash` strings (e.g. server `0x4216006b...`, client `0x42bd4cf9...`). Other state values from the same module (`amount`, `category` for newly-issued invoices, scheduling delays, block-tick jitter) flow only through `useEffect` and event handlers, so they do not contribute to the first-paint mismatch.

The fix must make the very first render deterministic across server and client, while preserving the live-streaming feel: invoices, payments, balances, and block ticks must continue to evolve randomly after mount.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the page is server-rendered and then hydrated on the client THEN the system emits a React hydration mismatch warning to the browser console
1.2 WHEN `useProtocolSimulation` is initialized during server render and again during client render THEN the system produces different `txHash` values for every entry of `INITIAL_INVOICES` because `generateTxHash()` calls `Math.random()` at module evaluation time
1.3 WHEN `SettlementLedger` renders its first paint THEN the system emits `<a href="https://sepolia.mantlescan.xyz/tx/${event.txHash}">` URLs whose `txHash` segments do not match between the SSR HTML and the client's first render, causing the attribute mismatch React reports
1.4 WHEN React detects the mismatched attributes during hydration THEN the system leaves the inconsistent attributes in place ("This won't be patched up"), so user-visible explorer links may point to hashes that exist neither on-chain nor in the React tree

### Expected Behavior (Correct)

2.1 WHEN the page is server-rendered and then hydrated on the client THEN the system SHALL complete hydration without emitting any React hydration-mismatch warnings
2.2 WHEN `useProtocolSimulation` is initialized during server render and again during client render THEN the system SHALL produce the same `INITIAL_INVOICES` array (identical `txHash`, `amount`, `category`, `id`, `status`, and tick fields) on both renders
2.3 WHEN `SettlementLedger` renders its first paint THEN the system SHALL emit identical `<a href="https://sepolia.mantlescan.xyz/tx/...">` markup on the server and on the client's first render

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the page has finished hydrating THEN the system SHALL CONTINUE TO advance the block counter approximately every 2 seconds via the `requestAnimationFrame` ticker
3.2 WHEN the page has finished hydrating THEN the system SHALL CONTINUE TO issue new invoices on the existing 4–7 second cadence with randomized `txHash`, `amount`, and `category`
3.3 WHEN the page has finished hydrating THEN the system SHALL CONTINUE TO promote `Issued` invoices to `Presented` and run the four-phase payment flow that settles `Presented` invoices to `Paid`
3.4 WHEN the user clicks the manual trigger surfaced by `AgentEconomy` THEN the system SHALL CONTINUE TO either settle a presented invoice, promote-and-settle an issued one, or mint-and-settle a fresh one, exactly as before
3.5 WHEN any input does not involve the initial render of `useProtocolSimulation` (mouse clicks, filter changes, scheduled ticks, payment-flow timers) THEN the system SHALL CONTINUE TO behave identically to the current implementation

## Bug Condition

```
FUNCTION isBugCondition(X)
  INPUT: X representing a fresh evaluation of the useProtocolSimulation module
         followed by an immediate first render of the component tree
  OUTPUT: boolean

  // The bug manifests on the very first render — the SSR pass and the
  // client's hydration pass each evaluate the module independently and
  // call Math.random() while constructing INITIAL_INVOICES.
  RETURN X.phase = "initial-render"
         AND X.runs.server.invoices != X.runs.client.invoices
END FUNCTION
```

## Property (Fix Checking)

```
// Property: Fix Checking — initial render is deterministic
FOR ALL X WHERE isBugCondition(X) DO
  serverInvoices := evaluateModuleAndRender(X).server.invoices
  clientInvoices := evaluateModuleAndRender(X).client.invoices
  ASSERT serverInvoices = clientInvoices
END FOR
```

## Preservation Goal

```
// Property: Preservation Checking — post-mount streaming is unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT useProtocolSimulation_original(X) = useProtocolSimulation_fixed(X)
END FOR
```

In practice, "post-mount streaming is unchanged" means: after the first render completes, the distributions and behaviors of `block`, `tvl`, newly-minted invoices' `txHash`/`amount`/`category`, and the four-phase payment flow remain observationally equivalent to the current implementation.
