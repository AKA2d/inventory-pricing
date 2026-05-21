import { getSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const price = body?.price;
    if (typeof price !== "number" || Number.isNaN(price) || price < 0) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Invalid price." } },
        { status: 400 },
      );
    }

    const value = JSON.stringify({ price, timestamp: new Date() });

    await prisma.cacheMetadata.upsert({
      where: { key: "aed_price_of_the_day" },
      create: { key: "aed_price_of_the_day", value },
      update: { value },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const record = await prisma.cacheMetadata.findUnique({
      where: { key: "aed_price_of_the_day" },
    });
    if (!record) return Response.json({ ok: true, value: null });
    try {
      const parsed = JSON.parse(record.value as unknown as string);
      return Response.json({ ok: true, value: parsed });
    } catch (err) {
      return Response.json({ ok: true, value: null });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
