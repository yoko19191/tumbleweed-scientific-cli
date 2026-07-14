export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode = 1,
    public readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CliError";
  }
}
