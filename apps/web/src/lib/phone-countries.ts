// Countries the public WhatsApp field can start on. The lead can still pick any other
// country in the field; this only sets the flag and calling code shown first.
export const PHONE_COUNTRIES = [
  { code: "BR", label: "Brasil (+55)" },
  { code: "PY", label: "Paraguai (+595)" },
  { code: "AR", label: "Argentina (+54)" },
  { code: "UY", label: "Uruguai (+598)" },
  { code: "PT", label: "Portugal (+351)" },
  { code: "US", label: "Estados Unidos (+1)" }
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["code"];

export const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((c) => c.code) as [PhoneCountry, ...PhoneCountry[]];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = "BR";

/** Unknown or legacy values fall back to Brazil, the field's historical default. */
export function toPhoneCountry(value: string | null | undefined): PhoneCountry {
  return PHONE_COUNTRY_CODES.includes(value as PhoneCountry) ? (value as PhoneCountry) : DEFAULT_PHONE_COUNTRY;
}
