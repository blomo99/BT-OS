import { redirect } from "next/navigation";

// Personal has been merged into Home; keep old links working.
export default function PersonalPage() {
  redirect("/");
}
