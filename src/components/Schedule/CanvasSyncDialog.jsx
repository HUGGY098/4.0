import React from "react";

export default function CanvasSyncDialog({ open, onOpenChange }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl p-6 border border-border max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          Canvas Sync
        </h2>

        <p className="text-muted-foreground mb-4">
          Canvas integration is not connected yet.
        </p>

        <button
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
