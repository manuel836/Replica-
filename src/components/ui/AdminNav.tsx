"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, Clock, MapPin, Package, Plus, Settings, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece en la barra inferior del celular (máximo 5). */
  mobile?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Agenda", icon: CalendarDays, mobile: true },
  { href: "/admin/t/nueva", label: "Nueva taquiza", icon: Plus, mobile: true },
  { href: "/admin/disponibilidad", label: "Disponibilidad", icon: Clock, mobile: true },
  { href: "/admin/paquetes", label: "Paquetes", icon: Package, mobile: true },
  { href: "/admin/zonas", label: "Zonas", icon: MapPin },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings, mobile: true },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Barra lateral en escritorio y barra inferior en celular (S11 a S18). */
export function AdminNav({ current }: { current?: string }) {
  const pathname = usePathname();
  const path = current ?? pathname ?? "";

  return (
    <>
      <nav aria-label="Panel" className="hidden w-sidebar shrink-0 flex-col gap-1 bg-ink p-3 text-on-ink md:flex">
        <p className="px-3 py-4 font-display text-lg text-brand">D&apos; Garden Tacos</p>
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-brand",
                "focus-visible:outline-brand",
                active ? "bg-brand text-on-accent" : "text-on-ink-muted hover:bg-on-ink/10 hover:text-on-ink",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </a>
          );
        })}
      </nav>

      <nav
        aria-label="Panel"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-on-ink/10 bg-ink pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {ADMIN_NAV.filter((i) => i.mobile).map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
                "focus-visible:-outline-offset-4 focus-visible:outline-brand",
                active ? "text-brand" : "text-on-ink-muted",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label.replace(" taquiza", "")}
            </a>
          );
        })}
      </nav>
    </>
  );
}
