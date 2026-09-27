import { AuthForm } from "@/features/auth/components/auth-form";
import { safeReturnPath } from "@/lib/auth/return-path";
export const metadata = { title: "회원가입" };
export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  return <AuthForm mode="signup" next={safeReturnPath(params.next)} />;
}
