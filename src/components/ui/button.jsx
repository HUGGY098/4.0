import React from "react";
import { cn } from "../../lib/utils";

export function Button({
  children,
  variant="default",
  size="default",
  className="",
  ...props
}) {

  const variants = {
    default:
      "bg-primary text-primary-foreground hover:opacity-90",

    outline:
      "border border-input bg-background hover:bg-accent",

    secondary:
      "bg-secondary text-secondary-foreground",

    ghost:
      "hover:bg-accent"
  };


  const sizes = {
    default:"px-4 py-2",
    sm:"px-3 py-1.5 text-sm",
    lg:"px-6 py-3"
  };


  return (
    <button
      className={cn(
        "rounded-lg font-medium transition",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
