import { Suspense } from "react";
import { ComparePicker } from "@/components/compare/compare-picker";
import { CompareTable } from "@/components/compare/compare-table";

export default function ComparePage() {
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8 space-y-8 h-full overflow-y-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Compare</h1>
        <p className="text-muted-foreground">
          See companies side-by-side against their sector medians. 
        </p>
      </div>
      
      <Suspense fallback={null}>
        <ComparePicker />
        <CompareTable />
      </Suspense>
    </main>
  );
}
