import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;


export function DialogContent({children}) {
  return (
    <DialogPrimitive.Portal>

      <DialogPrimitive.Overlay
        className="
        fixed inset-0 bg-black/40
        "
      />

      <DialogPrimitive.Content
        className="
        fixed left-1/2 top-1/2
        -translate-x-1/2 -translate-y-1/2
        w-full max-w-md
        rounded-xl
        border
        bg-background
        p-6
        shadow-xl
        "
      >
        {children}
      </DialogPrimitive.Content>

    </DialogPrimitive.Portal>
  );
}


export function DialogHeader({children}) {
  return <div className="mb-4">{children}</div>;
}


export function DialogTitle({children}) {
  return (
    <h2 className="text-xl font-semibold">
      {children}
    </h2>
  );
}
