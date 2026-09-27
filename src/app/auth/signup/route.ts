import { signUpWithPassword } from "@/lib/auth/mutations";
export async function POST(request: Request) { return signUpWithPassword(request); }
