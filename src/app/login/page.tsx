import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/lib/auth/return-path";
export const metadata = { title: "로그인" };
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return <AuthForm mode="login" next={safeReturnPath(params.next)} notice={typeof params.notice === "string" ? params.notice : undefined} />;
}
