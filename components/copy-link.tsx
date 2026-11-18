"use client";

import { useState } from "react";

// Copies `url`, and says so once it is copied. Where the browser does not
// allow copying, it shows the link to copy by hand.
export function CopyLink({ url }: { url: string }) {
  const [state, setState] = useState<"ready" | "copied" | "blocked">("ready");
  return (
    <>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => setState("copied"),
            () => setState("blocked"),
          )
        }
        className="mt-2 rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-800 transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-100 active:scale-[0.97]"
      >
        {state === "copied" ? "Copied" : "Copy the link"}
      </button>
      {state === "blocked" && (
        <input
          readOnly
          value={url}
          aria-label="The link"
          onFocus={(event) => event.target.select()}
          className="mt-2 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs"
        />
      )}
    </>
  );
}
