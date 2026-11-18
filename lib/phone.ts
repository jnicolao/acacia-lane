// Turns what a buyer types into an international number (E.164), or null when
// it cannot be one. The shop sells in Kenya, so a number without a country
// code is read as Kenyan: 0712 345 678, 712345678 and 254712345678 all become
// +254712345678.
export function normalizePhone(input: string): string | null {
  let number = input.replace(/[\s().-]/g, "");
  if (number.startsWith("00")) number = `+${number.slice(2)}`;
  else if (/^0[17]\d{8}$/.test(number)) number = `+254${number.slice(1)}`;
  else if (/^[17]\d{8}$/.test(number)) number = `+254${number}`;
  else if (/^254[17]\d{8}$/.test(number)) number = `+${number}`;

  if (number.startsWith("+254")) return /^\+254[17]\d{8}$/.test(number) ? number : null;
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}

// +254712345678 → "+254 712 345 678". Other countries are shown as they are.
export function formatPhone(phone: string): string {
  const kenyan = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return kenyan ? `+254 ${kenyan[1]} ${kenyan[2]} ${kenyan[3]}` : phone;
}
