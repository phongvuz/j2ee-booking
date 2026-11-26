export class BusinessError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "BusinessError";
  }
}

export function hasDatabaseCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
