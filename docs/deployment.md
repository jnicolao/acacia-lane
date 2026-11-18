# Putting it online

The shop runs well on one computer. This guide says what has to change before
it can live on the internet, and how to run it once that is done.

- [Where it stands today](#where-it-stands-today)
- [Two things to sort out first](#two-things-to-sort-out-first)
- [Choosing where to host](#choosing-where-to-host)
- [Running it on a server](#running-it-on-a-server)
- [Before you open the doors](#before-you-open-the-doors)
- [Showing it from your own computer](#showing-it-from-your-own-computer)

## Where it stands today

| Works today | Not yet |
| --- | --- |
| The shop, cart, checkout and order pages, for anyone | A sign-in for the owner |
| Orders placed with PickSpot | Private order pages |
| Updates from PickSpot, checked and applied | |
| The owner's side, on the shop's own computer | |
| Data on hosting without a lasting disk, in a Postgres database | |

## Two things to sort out first

### 1. Give the owner a way in

The owner's side (`/admin/...`) opens only for a browser on the same computer
as the shop. On a server, nobody is on that computer, so nobody could open
Orders or Settings, and nobody could save the API key.

What is needed is a sign-in: a password or an account, checked before any
owner's page or button. The one place to change is `lib/local-only.ts`; every
owner's page and action already calls it. Whatever replaces it should:

- keep the rule that every button's action checks for itself, not only the
  page it sits on;
- use a cookie that scripts cannot read and that is only sent over HTTPS;
- slow down repeated wrong guesses.

Do not simply remove the check. The owner's side shows customers' phone
numbers and can replace the API key.

### 2. Decide where data lives

Orders, the saved API key and the signing secret are files in `.data/`, or
rows in a Postgres database when `DATABASE_URL` is set.

- **On a server with a lasting disk** (a virtual machine, a container with a
  mounted volume) nothing needs to change. Make sure `.data/` is on the disk
  that lasts, and back it up.
- **On hosting that starts fresh for each request or each release** (Vercel,
  Netlify and similar) files do not last, so use a database. On Vercel, open
  the project's **Storage** tab and add Neon Postgres (it has a free plan). It
  sets `DATABASE_URL`, and the shop uses it from the next deployment. See
  [A database instead of files](configuration.md#a-database-instead-of-files).

With files, the shop assumes it runs as **one process**: two copies sharing
the same folder could both hand out the same order number. With a database,
any number of copies can run at once.

## Choosing where to host

| Kind of hosting | Sign-in needed | Storage | Verdict |
| --- | --- | --- | --- |
| Your own computer with a tunnel | No | Files, as they are | Works today. Good for showing it to someone |
| A server or container with a lasting disk | Yes | Files, as they are | The shortest path |
| Vercel, Netlify and similar | Yes | A Postgres database (`DATABASE_URL`) | Works once the sign-in exists |

## Running it on a server

Once the two things above are sorted out.

**1. Get the code and build it**

```bash
git clone https://github.com/jnicolao/acacia-lane.git
```

```bash
cd acacia-lane
```

```bash
npm ci
```

```bash
npm run build
```

**2. Set the environment**

| Variable | Value |
| --- | --- |
| `PICKSPOT_API_URL` | The PickSpot API address for the environment you are using |
| `PUBLIC_URL` | The shop's address, for example `https://shop.example.com` |
| `PORT` | The port to listen on, if not 3000 |

Do not set `PICKSPOT_MOCK`.

**3. Start it**

```bash
npm start
```

Keep it running with whatever the server uses for that (systemd, a container
restart policy, a process manager), and start it from the folder that holds
`.data/`, because the shop looks for that folder where it was started.

**4. Put HTTPS in front**

Run the shop behind a web server or load balancer that provides HTTPS and
passes requests on. PickSpot expects an `https://` webhook address in
production.

**5. Connect PickSpot**

Open Settings, save the API key, press "Check connection", copy the webhook
URL into your PickSpot business account, and save the signing secret it shows.
The steps are the same as in
[Getting started](getting-started.md#connect-a-real-pickspot-account), without
the tunnel.

## Before you open the doors

- [ ] The owner can sign in, and a stranger cannot open `/admin/orders`.
- [ ] The data lasts: `.data/` is on a disk that survives a restart and a new
      release, or `DATABASE_URL` is set. Either way, it is backed up.
- [ ] `PICKSPOT_API_URL` points at the right PickSpot.
- [ ] "Check connection" names your business and has no warning about a
      pickup location.
- [ ] The webhook URL in the PickSpot account is the one Settings shows, and
      the signing secret is saved.
- [ ] A test order goes all the way: WhatsApp link, payment, rider, delivered,
      with each step appearing in the order's history without pressing
      anything.
- [ ] The owner's pages do not show "Live updates are off".
- [ ] `PICKSPOT_MOCK` is not set, and no yellow banner shows.
- [ ] The product photos are ones you may use.

## Showing it from your own computer

To let someone else see the shop without hosting it, run it locally and open a
tunnel. The steps are in
[Getting started](getting-started.md#3-give-the-shop-a-public-address).

Through the tunnel, visitors can use the shop and PickSpot can deliver
updates. The owner's side stays closed to them and open to you on
`http://localhost:3000/admin`.

The tunnel addresses the shop accepts while running with `npm run dev` are
listed in `next.config.ts` (`allowedDevOrigins`). Add yours there if you use a
different tunnel service.

Next: [Making it yours](customising.md).
