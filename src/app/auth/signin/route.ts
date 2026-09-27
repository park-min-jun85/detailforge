import { signInWithPassword } from "@/lib/auth/mutations";
export async function POST(request: Request) { return signInWithPassword(request); }
