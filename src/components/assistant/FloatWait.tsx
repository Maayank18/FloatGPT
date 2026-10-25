/** Quiet blink while a reply is still forming. */
export function FloatWait() {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label="Working">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="float-wait-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
