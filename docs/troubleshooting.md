# When something is wrong

Find what you are seeing, then the cause and what to do. Two places tell you
most of what you need:

- **"Technical details"** at the bottom of an order on the owner's side: what
  the shop sent, what PickSpot answered, and every update recorded.
- **"Connection log"** at the bottom of Settings: every update PickSpot sent,
  whether its signature was right, and what the shop did with it.

Problems placing an order also leave a line in the terminal where the shop is
running.

## Orders

### An order stays on "Waiting for customer" after the customer has paid

The shop has not heard about it.

1. Open the order on the owner's side and press **Check for updates**. If the
   order jumps forward, PickSpot knew all along and its updates are not
   reaching the shop.
2. Look for the "Live updates are off" notice. If it is there, no web address
   is saved, so PickSpot has nowhere to send updates. See
   [Give the shop a public address](getting-started.md#3-give-the-shop-a-public-address).
3. If there is no notice, open the Connection log in Settings.
   - **Nothing in it**: the webhook URL in the PickSpot account is missing or
     wrong, or the tunnel has a new address. Copy the URL from Settings into
     the PickSpot account again.
   - **Entries that say the signature is not valid**: the signing secret in
     Settings is not the one PickSpot is using. Set the webhook again in the
     PickSpot account and save the new secret it shows.

An order's page catches up by itself every 15 seconds while it is open, so the
quickest relief is to keep the page open.

### "Sorry, we cannot take orders right now"

PickSpot refused the shop itself, not this order. Open Settings and press
**Check connection**; it says whether the API key is not recognised or the
business account is paused. The terminal has the same reason:
`Order … was not placed: 401 …`.

### "We could not place your order. Check your WhatsApp number and try again"

PickSpot rejected the order. The terminal line says why. Common causes:

- No pickup location is set in the PickSpot account. "Check connection"
  mentions it.
- The value of an item is outside what PickSpot allows.
- The number is not one PickSpot can use.

### "Something went wrong and your order was not placed"

The shop could not reach PickSpot, or `PICKSPOT_API_URL` is not set. Check the
internet connection and the value in `.env.local`, then restart the shop:
environment changes are read at start.

### The checkout will not accept a phone number

The shop accepts Kenyan mobile numbers typed locally (`0712 345 678`,
`712345678`) and any number in international form (`+44 7911 123456`). A
number from another country needs its country code with a `+`.

### Items have no picture in PickSpot

Open "Technical details" on the order and look under "Product pictures sent".

- **"no picture sent"**: the upload failed. The reason is in the note beside
  the first entry of "Every update, as recorded". The usual one is that
  PickSpot does not accept picture uploads from the shop's API key; that is
  for PickSpot to switch on.
- **A key is listed**: the shop did its part. Check the order in PickSpot.

The order is placed either way. Pictures never hold one up.

### A new order shows the details of an old one

PickSpot recognises an order by the shop's order number, and answers with the
existing order when it is given a number it has seen. This can only happen if
order numbers repeat, which the random part of the number is there to prevent.
It would take copying `.data/store.json` between two shops, or editing the
counter by hand. Give each shop its own `.data` folder.

### An order page says "This page could not be found"

The order is not in this shop's data. Either the number is mistyped, the order
was placed in the other mode (practice orders and real orders are kept
apart), or the data was deleted.

## Settings and connection

### "The shop has not been told where PickSpot is"

`PICKSPOT_API_URL` is not set. Copy `.env.example` to `.env.local`, fill it
in, and restart the shop.

### "PickSpot did not recognise the API key"

The key is wrong, incomplete, or was replaced or removed in the PickSpot
account. Create a new one there and save it in Settings. A key is shown only
once, so if it was not kept, a new one is the only way.

### "Live updates are off"

No web address is saved, so PickSpot cannot reach the shop. Orders still
update while their page is open. To get live updates, see
[Give the shop a public address](getting-started.md#3-give-the-shop-a-public-address).

### Activity warns that an update was turned away

The shop received something on its webhook URL that it could not confirm came
from PickSpot. If it happens for every update, the signing secret in Settings
does not match PickSpot's: set the webhook again in the PickSpot account and
save the new secret. If it happens once in a while, someone else is sending to
the URL, and the shop is right to ignore them.

PickSpot does not send an update again after the shop has turned it away.
Press **Check for updates** on the orders that changed in the meantime, or
open them and wait a few seconds.

### Updates stopped after restarting the tunnel

A free tunnel gets a new address each time. Save the new address in Settings
and paste the new webhook URL into the PickSpot account.

## The owner's side

### "This area is for the shop owner"

The owner's side only opens on the computer the shop runs on, at
`http://localhost:3000/admin`. Through a tunnel or a domain it is closed on
purpose. See [Who can open what](configuration.md#who-can-open-what).

### A button says "This can only be done on the computer the shop runs on"

The same rule, applied to a button rather than a page.

## Running the shop

### The yellow "Practice mode" banner is showing and I want real orders

The shop was started with `npm run dev:practice`, or `PICKSPOT_MOCK=1` is set.
Stop it and start it with `npm run dev`.

### My orders disappeared

Practice orders and real orders are in different files. Switching between
`npm run dev:practice` and `npm run dev` switches between them; nothing is
lost.

### "Port 3000 is in use"

Another copy of the shop, or something else, is using the port. Next.js picks
the next free one and prints it. To choose:

```bash
npm run dev -- -p 3001
```

### "Another next dev server is already running"

Only one development copy can run from the same folder. Stop the other one
first.

### Times look wrong

Dates are shown in Kenyan time whatever the server's clock is set to. To
change that, see [Money, phone numbers and time](customising.md#money-phone-numbers-and-time).

## Still stuck

Collect these before asking for help:

1. The order number.
2. "Technical details" from that order.
3. The matching entries from the Connection log.
4. The lines printed in the terminal around the time it happened.

None of these contain the API key or the signing secret. They do contain the
customer's phone number, so share them with care.
