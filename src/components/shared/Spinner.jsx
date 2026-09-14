export default function Spinner({ className = 'h-6 w-6', label }) {
  return (
    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
      <svg
        className={`animate-spin text-brand ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
