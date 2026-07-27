import React from "react";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground"
          }
        `}
      >
        {!isUser && (
          <div className="text-xs font-semibold text-primary mb-1">
            4.0
          </div>
        )}

        <p>
          {message.content}
        </p>
      </div>
    </div>
  );
}