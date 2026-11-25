import { Suspense } from "react";
import BoothInterior from "@/components/booth/BoothInterior";

export const metadata = { title: "부스 안 · 포토부스(가칭)" };

export default function BoothPage() {
  return (
    <Suspense fallback={null}>
      <BoothInterior />
    </Suspense>
  );
}
