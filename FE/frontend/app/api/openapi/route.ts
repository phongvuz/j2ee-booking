import specification from "@/documentation/api/openapi.json";

export function GET() {
  return Response.json(specification, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
