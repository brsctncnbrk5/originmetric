import { accountHttp } from "@/server/auth/account-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return accountHttp(request);
}
export async function POST(request: Request) {
  return accountHttp(request);
}
