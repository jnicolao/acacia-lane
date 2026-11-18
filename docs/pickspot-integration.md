# Working with PickSpot

Everything that passes between the shop and PickSpot: the calls the shop
makes, the order it sends, the updates it receives, and how each PickSpot code
becomes words on a page.

- [The four calls](#the-four-calls)
- [The order the shop sends](#the-order-the-shop-sends)
- [Phone numbers](#phone-numbers)
- [When the number already has an account](#when-the-number-already-has-an-account)
- [Product pictures](#product-pictures)
- [What PickSpot answers](#what-pickspot-answers)
- [Updates from PickSpot](#updates-from-pickspot)
- [Checking an update is genuine](#checking-an-update-is-genuine)
- [What the shop does with an update](#what-the-shop-does-with-an-update)
- [Asking instead of waiting](#asking-instead-of-waiting)
- [From codes to words](#from-codes-to-words)
- [When PickSpot says no](#when-pickspot-says-no)
- [The pretend PickSpot](#the-pretend-pickspot)

## The four calls

All of them are made by server code in `lib/pickspot.ts`. Each carries the
shop's API key in the `x-api-key` header and gives up after 15 seconds. The
address they go to is `PICKSPOT_API_URL` (see
[Settings and data](configuration.md#environment-variables)).

| When | Call | Why |
| --- | --- | --- |
| The owner presses "Check connection" | `GET /integrations/me` | To see that the key works and which business it belongs to |
| An order is placed, once per new product picture | `POST /integrations/images` | To give PickSpot the product's picture |
| An order is placed | `POST /integrations/checkout/orders` | To create the order |
| "Check for updates" is pressed, or an open order page catches up | `GET /integrations/checkout/orders/{order number}` | To learn where the order is now |

Every call comes back in one shape (`ApiResult` in `lib/types.ts`): either
`ok: true` with the data, or `ok: false` with the HTTP status and PickSpot's
message. A status of `0` means nothing was sent or nothing came back: no API
key saved, no PickSpot address set, or PickSpot could not be reached.

## The order the shop sends

Built by `buildOrderRequest` in `lib/checkout.ts`.

```json
{
  "reference": "AL-7K2F-1001",
  "recipient": { "phone": "+254712345678" },
  "items": [
    {
      "description": "Highland AA Coffee, 500 g",
      "quantity": 2,
      "unitValue": 1450,
      "currency": "KES",
      "sku": "AL-COF-500",
      "parcelClass": "SMALL",
      "imageKeys": ["<key from the picture upload>"]
    }
  ],
  "declaredItemCostKes": 2900,
  "autoDispatch": true,
  "metadata": {
    "platform": "CUSTOM",
    "storeUrl": "https://www.your-shop.com",
    "orderUrl": "https://www.your-shop.com/orders/AL-7K2F-1001"
  }
}
```

| Field | Where it comes from |
| --- | --- |
| `reference` | The shop's order number. PickSpot sends it back with every update, and that is how updates find their order. Sending the same number twice does not create a second order: PickSpot returns the first |
| `recipient.phone` | The WhatsApp number typed at checkout, in international form |
| `items[].description`, `quantity`, `unitValue` | From the shop's catalogue, never from the browser |
| `items[].currency` | Always `KES` |
| `items[].sku` | The product's stock code |
| `items[].parcelClass` | The product's size: `SMALL`, `MEDIUM` or `LARGE` |
| `items[].imageKeys` | The key of the product's picture, when the upload worked. Left out otherwise |
| `declaredItemCostKes` | The items total. PickSpot checks it against quantity × unit value |
| `autoDispatch` | `true`: PickSpot requests a rider by itself once the order is paid |
| `metadata.platform` | `CUSTOM`: this shop is not one of PickSpot's ready-made plugins |
| `metadata.storeUrl`, `orderUrl` | The shop's address and the order's page, when the shop knows its public address. Left out otherwise |

Two things PickSpot can accept are deliberately not sent:

- **When the customer will be home.** The shop does not ask.
- **A PickSpot address in place of a phone number.** The shop only takes a
  WhatsApp number.

## Phone numbers

`normalizePhone` in `lib/phone.ts` reads what the customer typed. The shop
sells in Kenya, so a number without a country code is read as Kenyan.

| Typed | Sent as |
| --- | --- |
| `0712 345 678` | `+254712345678` |
| `0112345678` | `+254112345678` |
| `712345678` | `+254712345678` |
| `254712345678` | `+254712345678` |
| `+254 712-345-678` | `+254712345678` |
| `00254712345678` | `+254712345678` |
| `(+44) 7911 123456` | `+447911123456` |
| `0712`, `12345`, `hello` | Refused |

A number that starts with `+254` must be a complete Kenyan mobile number.
Other countries are accepted in international form. The number is read again
on the server, so a request that skips the checkout page gets the same
treatment.

## When the number already has an account

PickSpot refuses a phone order with **409** and the code
`PHONE_LINKED_TO_ACCOUNT` when the number belongs to someone who already uses
PickSpot. It includes whose account it is, so a shop could ask "is this you?".

Acacia Lane does not ask. It sends the same order again with
`recipient.forceClaim: true`, which tells PickSpot to send the WhatsApp link
anyway. The reasons:

- Anyone can type anyone's number. Showing the name on an account to whoever
  typed the number would hand out personal details.
- The customer who owns the number gets the link on their own phone, and
  claims the order with their own account there.

The account details in the 409 are discarded in `lib/pickspot.ts`. They are
not stored and never reach the browser. Under "Technical details" the order
notes that PickSpot first answered 409.

## Product pictures

PickSpot shows a picture next to each item. The order does not carry the
picture itself; it is uploaded first (`lib/item-images.ts`):

1. The shop sends the photo with its API key: `POST /integrations/images`, as
   `multipart/form-data`, with the file in a field named `image` (any image
   type, up to 10 MB).
2. PickSpot answers `201` with `{ "key": "…", "url": "…" }`. The `url` is only
   for previewing; the shop does not use it.
3. The shop puts that key in the item's `imageKeys`.

Each picture is uploaded once. The shop remembers the key against the PickSpot
address and the contents of the file, in `.data/image-keys.json`. Replace a
photo and it is uploaded again; point the shop at a different PickSpot and
everything is uploaded again there.

A picture never holds up an order. If an upload fails, the shop stops trying
for that order, places it without pictures, and writes the reason next to the
order's first update under "Technical details". PickSpot refuses a picture
that is missing, is not an image, or is larger than 10 MB (400), and any
upload with a wrong API key (401).

## What PickSpot answers

Creating an order, asking about one, and every update all carry the order as
PickSpot sees it (`IntegrationOrder` in `lib/types.ts`). The shop keeps the
latest one on the order and uses these parts of it:

| Part | Used for |
| --- | --- |
| `status` | The order's badge and what the customer is told to do next |
| `updatedAt` | Telling new from old |
| `pricing` | The delivery fee, the service fee and the total. Unknown until the customer has given an address |
| `claim.claimUrl` | The customer's link. The order page has a **Copy the link** button for it, to share in case the WhatsApp message does not arrive |
| `claim.whatsapp` | Whether the WhatsApp message is on its way, sent, or could not be sent |
| `parcelCode` | The PickSpot parcel number shown to the owner |
| `dispatch.scheduledFor`, `dispatch.courier.name` | When the rider is due and who it is |
| `dispatch.trackingUrl` | The "Follow the rider on the map" link on the owner's order page |
| `kind`, `rawStatus`, `orderId`, `claimId` | Shown only under "Technical details" |

An order starts as a claim (`kind: CLAIM`): PickSpot is waiting for the
customer to open the link. Once they do, it becomes a parcel (`kind: PARCEL`)
with a parcel number. The shop's order number stays the same throughout.

## Updates from PickSpot

PickSpot sends a `POST` to the shop's webhook URL,
`<the shop's address>/api/pickspot/webhook`, whenever an order changes. The
body is JSON:

```json
{
  "id": "0b6f2a3e-…",
  "event": "order.paid",
  "createdAt": "2026-11-18T08:15:30.000Z",
  "data": { "reference": "AL-7K2F-1001", "status": "PAID", "updatedAt": "…" }
}
```

| Field | What it is |
| --- | --- |
| `id` | Unique to this delivery. The shop uses it to recognise a repeat |
| `event` | What happened, as one of sixteen names (see [the table below](#what-happened)) |
| `createdAt` | When PickSpot sent it |
| `data` | The whole order as PickSpot sees it now |

## Checking an update is genuine

Anyone can send a `POST` to a public address. PickSpot signs each update with
a secret that only it and the shop know, and the shop checks the signature
before believing a word (`lib/signature.ts`).

The signature travels in a header:

```text
X-Pickspot-Signature: t=1794988800,v1=5f2b…c9e1
```

- `t` is the time PickSpot signed it, in seconds.
- `v1` is `HMAC_SHA256(secret, "<t>.<the body exactly as received>")`, in
  hexadecimal.

The shop works out the same value and accepts the update only if all of these
hold:

1. A signing secret is saved in Settings.
2. The header is present and has exactly this form.
3. The two values match. They are compared in constant time, so the time the
   comparison takes gives nothing away.
4. `t` is within 5 minutes of now, so an old update cannot be replayed later.

The check uses the body exactly as it arrived, before it is read as JSON.
Reading it first and writing it out again could change a space or the order
of fields, and the signature would no longer match.

## What the shop does with an update

Decided by `processWebhook` in `lib/webhook.ts`. Whatever the outcome, the
update is written to the connection log.

| What the shop finds | It answers | And then |
| --- | --- | --- |
| The signature is wrong, missing, or too old | `401` | Nothing changes. Activity shows a warning. PickSpot does not try again after a 401 |
| It is genuine but is not an update (no id, event or status) | `400` | Nothing changes |
| It has seen this `id` before | `200` | Nothing changes: it is a repeat |
| It is for an order number the shop does not have | `200` | Nothing changes. Activity shows a note |
| It is older than what the shop already knows | `200` | It is recorded but the order does not move backwards |
| It is news | `200` | The order moves on, and the step appears in its history |

"Older" and "newer" are decided by `data.updatedAt`, PickSpot's own time for
the order, falling back to the update's `createdAt`. The order they happen to
arrive in does not matter.

The status always comes from `data.status`. The event name is only used to
choose the sentence in the order's history.

## Asking instead of waiting

The shop does not rely on updates alone, because one can be lost and a 401 is
never retried.

- **Check for updates** on the owner's order page asks PickSpot for the order
  and records the answer.
- **An open order page catches up by itself** every 15 seconds while the order
  is unfinished. See [Catching up](how-it-works.md#catching-up).

Both use `GET /integrations/checkout/orders/{order number}`. PickSpot accepts
the shop's own order number there, and keeps answering for it after the claim
has become a parcel.

## From codes to words

Both tables are in `lib/wording.ts`, except the customer's next step, which is
in `app/orders/[reference]/page.tsx`.

### Where the order is

| PickSpot's status | Badge | What the customer is told |
| --- | --- | --- |
| `AWAITING_RECIPIENT` | Waiting for customer | Check WhatsApp: PickSpot is sending you a link. Open it and tell PickSpot where to deliver; you then see the total and pay by M-Pesa |
| `AWAITING_APPROVAL` | Waiting for approval | Almost there: approve the order in PickSpot and pay the total by M-Pesa. Nothing has been charged yet |
| `AWAITING_PAYMENT` | Waiting for payment | Check your phone: an M-Pesa prompt is waiting for your PIN |
| `PAYMENT_FAILED` | Payment failed | The M-Pesa payment did not go through. You can try again from the PickSpot app |
| `PAID` | Paid | Payment received. PickSpot is finding a rider |
| `SCHEDULED` | Pickup scheduled | Payment received. The rider pickup is scheduled |
| `DISPATCHED` | Rider on the way | A rider has been sent to collect your order from the shop |
| `IN_TRANSIT` | Out for delivery | Your order is on its way to you |
| `DELIVERED` | Delivered | Your order was delivered. Enjoy! |
| `RETURNED` | Returned | The parcel was returned to the shop |
| `CANCELLED` | Cancelled | This order was cancelled |
| `REJECTED` | Declined | This order was declined in the PickSpot app |
| `EXPIRED` | Expired | This order expired before it was approved |
| `UNKNOWN` | Processing | We are arranging your delivery with PickSpot |

### What happened

| PickSpot's event | In the order's history |
| --- | --- |
| `order.created` | PickSpot received the order |
| `claim.sent` | The WhatsApp link was sent to the customer |
| `claim.claimed` | The customer opened the link and gave a delivery address |
| `claim.rejected` | The customer declined the order from the WhatsApp link |
| `claim.expired` | The WhatsApp link expired before the customer used it |
| `order.rejected` | The customer declined the order |
| `order.expired` | The order expired before the customer approved it |
| `order.paid` | The customer paid |
| `order.dispatch_scheduled` | A rider pickup was scheduled |
| `order.dispatched` | A rider is on the way to collect the order |
| `order.in_transit` | The order is on its way to the customer |
| `order.delivered` | The order was delivered |
| `order.return_initiated` | The order is being returned to the shop |
| `order.returned` | The order came back to the shop |
| `order.cancelled` | The order was cancelled |
| `order.availability_updated` | The customer changed when they will be home |

When the shop learns of a change by asking rather than from an update, there
is no event name. The history then uses a sentence chosen by the status
instead ("The customer paid", "The order was delivered").

An event the shop has no sentence for is also described by its status, so a
new kind of update from PickSpot never shows up as a code.

## When PickSpot says no

The shopper is never shown a status code or PickSpot's own message.

| What went wrong | The shopper sees | The owner finds out from |
| --- | --- | --- |
| The number is not a phone number | "Enter a mobile number, like 0712 345 678 or +254 712 345 678", before anything is sent | Nothing to do |
| PickSpot rejects the order (400) | "We could not place your order. Check your WhatsApp number and try again" | The server log |
| The API key is wrong, or the account is paused (401, 403) | "Sorry, we cannot take orders right now. Please try again later" | The server log; "Check connection" in Settings says which it is |
| PickSpot is busy (429) | "We are getting a lot of orders right now. Please try again in a moment" | The server log |
| PickSpot cannot be reached | "Something went wrong and your order was not placed. Please try again" | The server log |

The server log line reads `Order AL-7K2F-1001 was not placed: 401 Invalid API
key`. An order that PickSpot refused is removed from the shop, so no order
exists that PickSpot does not know about.

## The pretend PickSpot

Practice mode (`PICKSPOT_MOCK=1`) replaces the four calls with
`lib/pickspot-mock.ts`. It behaves the way the real one is documented to:

- Any mobile number gets an order waiting for the customer, with a made-up
  link.
- A number ending in `000` already has an account: the first try is refused
  with 409, the retry with `forceClaim` goes through.
- Fees are made up: KES 180 for delivery and KES 50 for service, known once
  the customer has "opened the link".
- Picture uploads always succeed and return a made-up key.
- "Make it happen" on the owner's order page changes the pretend order, builds
  the update PickSpot would send, signs it with a built-in practice secret
  (or the saved one), and delivers it to the shop's own webhook URL over HTTP.
  The shop's receiver cannot tell the difference, which is the point.

Practice orders are kept in their own files, apart from real ones.

Next: [Settings and data](configuration.md).
