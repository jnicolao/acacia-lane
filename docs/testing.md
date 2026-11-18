# Testing

Three ways to know the shop works: the automated tests, practice mode, and a
real order from start to finish.

- [The automated tests](#the-automated-tests)
- [What each test file covers](#what-each-test-file-covers)
- [Practice mode as a test bench](#practice-mode-as-a-test-bench)
- [A real end-to-end run](#a-real-end-to-end-run)
- [Before you commit](#before-you-commit)

## The automated tests

```bash
npm test
```

There are 56 tests in nine files, next to the code they test in `lib/`. They
run in about a second, need no internet, and never touch the shop's real
data or call PickSpot.

They cover the parts where a mistake would be costly or hard to see: deciding
whether an update is genuine, deciding what to do with it, building the order
that is sent, reading phone numbers, uploading pictures, and turning codes
into words.

To run one file, or to re-run on every change:

```bash
npx vitest run lib/webhook.test.ts
```

```bash
npx vitest
```

## What each test file covers

### `lib/signature.test.ts` (9 tests)

Is an update really from PickSpot?

- Accepts a signature made exactly as PickSpot documents it.
- Accepts a time up to 5 minutes away, earlier or later.
- Rejects a signature made with another secret.
- Rejects a time that is too old, and one too far in the future.
- Rejects a body that was changed after signing.
- Rejects a time that was changed to look fresh.
- Rejects a missing header, and badly formed ones.
- Rejects everything while no secret is saved.

### `lib/webhook.test.ts` (10 tests)

What happens to an update once it arrives?

- A genuine update changes the order and is logged.
- The same update arriving twice changes nothing the second time.
- An update that arrives late does not move the order backwards.
- When PickSpot gives no time for the order, the update's own time decides.
- An update for an order the shop does not have is logged without failing.
- A wrong signature gets 401, the reason is logged, and nothing changes.
- An update that was turned away is not counted as seen: when it is sent
  again with the right signature, it is applied.
- A body that is not JSON is logged, not crashed on.
- An answer from PickSpot is treated as news only when it is later than what
  the shop has, or, with no time to compare, when the status differs.

### `lib/item-images.test.ts` (4 tests)

Do product pictures reach PickSpot?

- Each product's picture is uploaded and its key goes into the order.
- The upload is sent the way PickSpot expects: a file in a field named
  `image`, with the API key, and no content type of the shop's own.
- A picture is uploaded once, and again for a different PickSpot address.
- When PickSpot refuses an upload, the order goes without pictures, the reason
  is reported, no second upload is tried, and nothing is remembered.

### `lib/checkout.test.ts` (2 tests)

Is the order built correctly?

- The body carries every item field, the picture keys and the items total,
  and leaves the picture key out for a product whose upload failed.
- The shop's address and the order's page are added when the shop knows its
  public address.

### `lib/phone.test.ts` (15 tests)

Are phone numbers read the way people type them?

- Seven ways of typing a number, all read correctly.
- Seven things that are not phone numbers, all refused.
- Numbers are grouped for display.

### `lib/wording.test.ts` (2 tests)

Does anything technical leak onto the page?

- An order's history is told in plain sentences. Checks that found nothing
  new and updates that arrived late are left out.
- The Activity feed lists every order's history and the updates that were
  turned away, newest first, without the words "webhook", "HTTP" or
  "signature".

### `lib/data-file.test.ts` (6 tests)

Does the database keep the data the way the files do?

- A document that was never saved reads as its starting value.
- It can be read from the database itself, past the cache.
- Each change starts from what is saved, is saved, and hands back its result.
- Saving a whole document replaces it.
- A change that fails leaves the document as it was, and the next one works.
- Each save empties the shared cache for that document.

### `lib/db.test.ts` (2 tests)

Does a buyer always find the order they just placed?

- An order in the cached copy is found without asking the database.
- An order placed a moment ago, not yet in the cache, is found by asking the
  database itself.

### `lib/owner.test.ts` (6 tests)

Can only the owner get in?

- The sign-in cookie works until it runs out, and stops working when the
  password is changed.
- A cookie cannot be made without the shop's secret, nor made to last longer
  by editing it.
- The right password lets the owner in and clears earlier wrong tries.
- After 5 wrong tries an address has to wait, even with the right password,
  while other addresses are not held up.
- The address may try again 15 minutes later.

### How they stay away from real data

The tests that would read or write files replace the file layer with one that
lives in memory, and replace the network with a stand-in that records what was
sent. The webhook tests build their own small shop in memory and pass it in.
The database tests run against Postgres inside the test itself (PGlite), never
the one in `DATABASE_URL`. Nothing under `.data/` is read or written.

## Practice mode as a test bench

Practice mode runs the real shop against a pretend PickSpot. The pretend
PickSpot delivers its updates to the shop's real receiver over HTTP, signed
the real way, so everything from the checkout to the order history is
exercised.

```bash
npm run dev:practice
```

| To see | Do this |
| --- | --- |
| An ordinary order | Check out with any mobile number |
| A customer who already uses PickSpot | Check out with a number ending in `000`. The order looks the same; under "Technical details" it says PickSpot first answered 409 |
| A number that is refused | Type `0712` at checkout |
| Each step of a delivery | On the owner's order page, use "Practice mode: move this order along" |
| A declined or expired order | Choose "The customer declined the order" or "The order expired…" |
| What was sent to PickSpot | "Technical details" at the bottom of the owner's order page |
| Every update received | "Connection log" at the bottom of Settings |

Practice orders are kept apart from real ones. Delete `.data/store.mock.json`
to clear them.

## A real end-to-end run

For this you need a PickSpot business account, the shop connected to it
(see [Getting started](getting-started.md#connect-a-real-pickspot-account)),
and a WhatsApp number you can read.

**Connection**

- [ ] "Check connection" names your business and has no warning about a
      pickup location.
- [ ] The owner's pages do not show "Live updates are off".

**An order**

- [ ] Check out with your number. The order page says to check WhatsApp, and
      the owner's list shows the order as "Waiting for customer".
- [ ] The WhatsApp message arrives. The link in it is the one behind "Open
      the link here" on the order page.
- [ ] Open the link, give an address, approve and pay. Without pressing
      anything in the shop, the order's history gains "The customer opened
      the link…" and "The customer paid", and the fees and total appear.
- [ ] As the rider collects and delivers, the history and the badge follow.
- [ ] The order appears in the PickSpot app with a picture for each item.
- [ ] Under "Technical details", the request that was sent matches
      [the order the shop sends](pickspot-integration.md#the-order-the-shop-sends).

**When things go wrong**

- [ ] Check out with a number that already has a PickSpot account. Nothing
      about the account shows anywhere in the shop.
- [ ] Remove the shop's web address in Settings, change an order in PickSpot,
      and keep its page open: within 15 seconds it catches up. Put the
      address back.
- [ ] Replace the signing secret in Settings with a wrong one and cause an
      update. Activity warns that an update was turned away; the Connection
      log says the signature does not match. Save the right secret and press
      "Check for updates": the order catches up.
- [ ] Replace the API key with a wrong one. "Check connection" says PickSpot
      did not recognise it; the checkout says the shop cannot take orders
      right now. Save the right key.

## Before you commit

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

All four should finish without errors. GitHub runs the same four on every
push to `main` and every pull request (`.github/workflows/ci.yml`), and shows
the result next to the commit or pull request.

Next: [When something is wrong](troubleshooting.md).
