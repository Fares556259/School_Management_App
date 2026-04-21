import { redirect } from "next/navigation";

export default function SignUpRedirect() {
  redirect("/request-setup");
  return null;
}
