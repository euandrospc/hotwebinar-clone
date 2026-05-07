import "./core.css";
import "react-phone-number-input/style.css";
import dynamic from "next/dynamic";

const PhoneInput = dynamic(() => import("react-phone-number-input"), { ssr: false });
export { PhoneInput };