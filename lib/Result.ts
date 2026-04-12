/**
 * Result type for railway-oriented programming.
 * Never throws — always returns ok() or err().
 */

/** Unwrap a result in a safe pipeline. */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T, E = string>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E = string>(error: E): Result<T, E> {
  return { ok: false, error };
}

/** Type guard — narrow to ok branch. */
export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok === true;
}

/** Type guard — narrow to err branch. */
export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return r.ok === false;
}

/** Map the ok value through f. Pass error through unchanged. */
export function map<T, U, E>(
  r: Result<T, E>,
  f: (val: T) => U
): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Map the error through f. Pass ok value through unchanged. */
export function mapErr<T, E, F>(
  r: Result<T, E>,
  f: (err: E) => F
): Result<T, F> {
  return r.ok ? r : err(f(r.error));
}

/** Flat-map the ok value. Pass error through unchanged. */
export function flatMap<T, U, E>(
  r: Result<T, E>,
  f: (val: T) => Result<U, E>
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

/** Unwrap or throw — use only when you're sure the result is ok. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw new Error(`unwrap() called on err: ${r.error}`);
  return r.value;
}

/** Unwrap or return a default. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/** Execute callbacks based on result — the functional if/else. */
export function match<T, E, U>(
  r: Result<T, E>,
  onOk: (val: T) => U,
  onErr: (err: E) => U
): U {
  return r.ok ? onOk(r.value) : onErr(r.error);
}