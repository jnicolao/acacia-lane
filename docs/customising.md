# Making it yours

How to change the shop's name, what it sells, how it looks and what it says.
Each change is in one place.

- [The name](#the-name)
- [The products](#the-products)
- [The photos](#the-photos)
- [The wording](#the-wording)
- [The colours](#the-colours)
- [Money, phone numbers and time](#money-phone-numbers-and-time)

## The name

`lib/brand.ts` holds two values:

```ts
export const SHOP_NAME = "Acacia Lane";
export const SHOP_INITIALS = "AL";
```

- `SHOP_NAME` appears in the header, the footer and the browser tab.
- `SHOP_INITIALS` is the logo mark in the header and the start of every order
  number (`AL-7K2F-1001`).

Changing the initials changes the numbers of new orders only. Orders already
placed keep theirs, because PickSpot knows them by that number.

The strapline under the name on the front page is in `app/page.tsx`, and the
description search engines see is in `app/layout.tsx`.

## The products

The catalogue is the `products` list in `lib/products.ts`. Each product is one
entry:

```ts
{
  id: "coffee",
  sku: "AL-COF-500",
  name: "Highland AA Coffee, 500 g",
  description: "Medium roast whole beans from the slopes of Mount Kenya.",
  price: 1450,
  parcelClass: "SMALL",
  image: "/products/coffee.jpg",
}
```

| Field | What it is | Notes |
| --- | --- | --- |
| `id` | The product's name inside the shop | Short, no spaces, never reused. Carts and orders refer to it |
| `sku` | Your stock code | Sent to PickSpot with the order |
| `name` | What customers see, and what PickSpot shows as the item | |
| `description` | The line under the name on the front page | Two lines are shown; longer text is cut with "…" |
| `price` | Price in Kenyan shillings | A whole number. Sent to PickSpot as the item's value |
| `parcelClass` | How big the parcel is: `SMALL`, `MEDIUM` or `LARGE` | PickSpot uses it to choose the right rider |
| `image` | The product's photo | A path under `public/`. See [The photos](#the-photos) |

To add a product, add an entry and a photo. To remove one, delete the entry.
Orders already placed keep the name and price they were placed with.

The shop prices every order from this list on the server. A price sent by a
browser is ignored, so nobody can order at a price of their choosing.

## The photos

Photos are in `public/products/`, one per product. The same file is shown in
the shop and sent to PickSpot, so the customer sees the same picture in both.

- **Format**: JPEG. The upload to PickSpot is labelled as JPEG, so other
  formats need a change in `lib/item-images.ts`.
- **Shape**: the shop shows photos three wide by two tall, and square in the
  cart. Keep the subject in the middle. The current photos are 1200 × 800.
- **Size**: PickSpot accepts up to 10 MB. Smaller loads faster; the current
  ones are between 40 and 170 KB.

Replace a file and the shop shows the new photo at once. PickSpot gets it with
the next order for that product: the shop notices the file has changed and
uploads it again.

If you use photos you did not take, check that you may, and update the credits
in the README.

## The wording

Everything the shop says about an order's progress is in `lib/wording.ts`.

| What | Where | Example |
| --- | --- | --- |
| Status badges | `STATUS_LABEL` | `IN_TRANSIT` → "Out for delivery" |
| What happened, for each update from PickSpot | `EVENT_TEXT` | `order.paid` → "The customer paid" |
| What happened, when only the status is known | `STATUS_TEXT` | `DELIVERED` → "The order was delivered" |
| Warnings in Activity | `shopActivity` | "An update from PickSpot was turned away…" |

What the customer is told to do next, for each status, is the `NEXT_STEP` list
in `app/orders/[reference]/page.tsx`. What a shopper is told when an order
cannot be placed is `problemText` in `components/checkout-form.tsx`. The three
steps on the checkout page are the `STEPS` list in the same file.

Two rules keep the shop readable:

- **No codes on screen.** A status code, an event name or an HTTP status
  belongs only under "Technical details" on the owner's order page and in the
  "Connection log" in Settings. Everywhere else, add a sentence to
  `lib/wording.ts` and use that.
- **Sentences have no full stop in `lib/wording.ts`.** The pages add it, and
  some join a sentence to other text.

Every status must have an entry in each list: TypeScript refuses to build if
one is missing. An event without a sentence falls back to the sentence for its
status.

## The colours

The shop is styled with Tailwind CSS classes written next to the elements they
style. There is no theme file.

- **Accent**: `emerald-700` (buttons, links, the logo), `emerald-800` on
  hover, `emerald-50` for the highlighted box at checkout.
- **Text and lines**: the `stone` greys.
- **Status badges**: `components/status-badge.tsx` groups statuses into
  waiting (amber), moving (sky), delivered (emerald) and ended badly (red).
- **Practice mode**: amber.

To change the accent, replace `emerald` across `app/` and `components/`.

The typeface is Geist, loaded in `app/layout.tsx`.

## Money, phone numbers and time

| To change | Edit |
| --- | --- |
| How money is written (`KES 1,450`) | `kes` in `lib/format.ts` |
| The currency sent to PickSpot | `linesToPickspotItems` in `lib/products.ts`. PickSpot accepts `KES` |
| Which country a number without a country code belongs to | `normalizePhone` in `lib/phone.ts`, with its tests in `lib/phone.test.ts` |
| How a phone number is shown | `formatPhone` in `lib/phone.ts` |
| The time zone dates are shown in | `timeZone` in `lib/format.ts` |

After any change, run the checks:

```bash
npm run typecheck
```

```bash
npm test
```

Next: [Testing](testing.md).
