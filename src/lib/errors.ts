import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500 },
  );
}
