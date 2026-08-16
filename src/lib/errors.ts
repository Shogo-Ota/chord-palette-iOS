/**
 * Application error hierarchy. Separates a user-facing message (safe to show in
 * the UI, Japanese) from a developer message (for logs). Feature code should
 * throw one of these subclasses rather than a bare `Error`.
 */
export type AppErrorOptions = {
  /** Underlying error, preserved for logging. */
  cause?: unknown;
  /** Developer-facing detail (English/technical). Defaults to userMessage. */
  devMessage?: string;
};

export class AppError extends Error {
  /** Safe, localized message to display to the user. */
  readonly userMessage: string;

  constructor(userMessage: string, options?: AppErrorOptions) {
    super(options?.devMessage ?? userMessage);
    this.name = new.target.name;
    this.userMessage = userMessage;
    if (options?.cause !== undefined) {
      // Set explicitly for Hermes compatibility.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Local project persistence (expo-sqlite) failure. */
export class ProjectStorageError extends AppError {}
/** Native audio engine failure. */
export class AudioEngineError extends AppError {}
/** Native video export failure. */
export class VideoExportError extends AppError {}
/** Standard MIDI File export failure. */
export class MidiExportError extends AppError {}
/** Billing (RevenueCat) failure. */
export class BillingError extends AppError {}
/** Backend / network (Convex) failure. */
export class BackendError extends AppError {}
