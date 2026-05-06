import { redirect } from "next/navigation";

// Decoy: /login redirects to public webinar list. Real admin login lives at ADMIN_LOGIN_PATH.
export default function LoginRedirect() {
  redirect("/webinars");
}
