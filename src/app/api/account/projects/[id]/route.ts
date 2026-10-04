import { accountHttp } from "@/server/auth/account-http";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ id: string }> }) {
  return accountHttp(request, (await context.params).id);
}
export { handle as GET, handle as POST };
