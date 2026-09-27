import { signOut } from "@/lib/auth/mutations";
export async function POST(request: Request) {
  const response = await signOut(request);
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
