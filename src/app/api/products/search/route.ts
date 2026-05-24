import { NextRequest } from "next/server";
import { productSearchSchema } from "@/lib/products/dto";
import { searchProducts } from "@/lib/products/service";
import { errorResponse } from "@/lib/errors";
import { getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Login required." } },
        { status: 401 },
      );
    }

    const parsed = productSearchSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await searchProducts(parsed.q, parsed.page, parsed.pageSize);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
