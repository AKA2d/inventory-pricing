import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { refreshStaleProducts } from "@/lib/products/service";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin role required." } }, { status: 403 });
    }

    const refreshed = await refreshStaleProducts();
    return Response.json({ refreshed });
  } catch (error) {
    return errorResponse(error);
  }
}
