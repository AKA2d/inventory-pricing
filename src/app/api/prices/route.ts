import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { priceUpdateSchema } from "@/lib/products/dto";
import { updateProductPrices } from "@/lib/products/pricing-service";

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Login required." } },
        { status: 401 },
      );
    }

    if (session.role !== "ADMIN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const body = priceUpdateSchema.parse(await request.json());
    const rows = await updateProductPrices(body.updates, session);
    return Response.json({ ok: true, rows });
  } catch (error) {
    return errorResponse(error);
  }
}
