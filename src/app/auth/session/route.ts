import { requireApiUser } from "@/lib/auth/guards";
export async function GET() {
  const result = await requireApiUser();
  if (!result.ok) return result.response;
  return Response.json({ principal: result.principal }, { headers: result.headers });
}
