
import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-40 bg-black/40"
      />

      <DialogPrimitive.Content
        {...props}
        className={`fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background p-6 text-foreground shadow-xl outline-none max-h-[85vh] overflow-y-auto ${props.className || ""}`}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }) {
  return <div className="space-y-1">{children}</div>;
}

export function DialogTitle({ children }) {
  return (
    <DialogPrimitive.Title className="text-xl font-semibold">
      {children}
    </DialogPrimitive.Title>
  );
}
