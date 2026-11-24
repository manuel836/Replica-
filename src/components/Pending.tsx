import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/Feedback";

/** Pantalla que existe en el mapa pero todavía no se construye. */
export function Pending({ screen, title }: { screen: string; title: string }) {
  return (
    <div className="mx-auto w-full max-w-flow px-4 py-12">
      <EmptyState icon={Hammer} title={title}>
        {screen}: esta pantalla está en construcción.
      </EmptyState>
    </div>
  );
}
