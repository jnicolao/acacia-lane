// Shown instead of an admin page to anyone who is not on the shop's own computer.
export function LocalOnly() {
  return (
    <div className="rounded-xl border border-stone-300 bg-white p-6">
      <h1 className="text-lg font-semibold">This area is for the shop owner</h1>
      <p className="mt-2 text-sm text-stone-600">
        Orders and settings can only be opened on the computer the shop runs
        on. If you are a customer, everything you need is in the shop.
      </p>
    </div>
  );
}
