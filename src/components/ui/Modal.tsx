"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Radix Dialog: atrapa el foco, Escape cierra y el foco regresa al botón que lo abrió. */
export function Modal({ open, onOpenChange, trigger, title, description, children, footer }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-lg bg-surface p-5 shadow-pop sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl text-text">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="-m-2 flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
                aria-label="Cerrar"
              >
                <X aria-hidden className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          {description && <Dialog.Description className="text-base text-text-muted">{description}</Dialog.Description>}
          {children}
          {footer && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
  children?: ReactNode;
}

/** Confirmación para acciones que no se deshacen (cancelar, rechazar, reembolsar). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Volver",
  tone = "danger",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      trigger={trigger}
      title={title}
      description={description}
      footer={
        <>
          <Dialog.Close asChild>
            <Button variant="secondary" disabled={busy}>
              {cancelLabel}
            </Button>
          </Dialog.Close>
          <Button
            variant={tone}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
