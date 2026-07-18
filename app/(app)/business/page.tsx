import { Suspense } from "react";
import BusinessTab from "@/components/BusinessTab";

export default function BusinessPage() {
  return (
    <div className="fade-up">
      <Suspense>
        <BusinessTab />
      </Suspense>
    </div>
  );
}
