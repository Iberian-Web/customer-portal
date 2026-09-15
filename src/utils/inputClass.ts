// customer-portal/src/utils/inputClass.ts
export const getInputClass = (hasError?: boolean | string) =>
  `w-full bg-zinc-100 dark:bg-zinc-800 border rounded-xl px-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? "border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
      : "border-zinc-300 dark:border-zinc-700 focus:border-teal-500 focus:ring-teal-500/30"
  }`;
