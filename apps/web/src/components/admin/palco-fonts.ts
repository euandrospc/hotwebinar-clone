import { DM_Sans, Instrument_Serif } from "next/font/google";

const sans = DM_Sans({ subsets: ["latin"], variable: "--palco-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--palco-serif", display: "swap" });

/** CSS variables for the Palco fonts; use with Tailwind `font-palco` / `font-palco-serif`. */
export const palcoFonts = `${sans.variable} ${serif.variable}`;
