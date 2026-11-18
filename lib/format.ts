export function kes(amount: number): string {
  return `KES ${new Intl.NumberFormat("en-KE").format(amount)}`;
}

// "18 Nov, 14:05", in Kenyan time wherever the shop's server happens to be.
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
