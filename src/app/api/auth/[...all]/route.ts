import { getAuth } from "@/server/data/auth";
import { handleAuthRequest } from "@/server/auth/handler";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL)
    return Response.json({ message: "Authentication is not configured." }, { status: 503 });
  try {
    return await handleAuthRequest(request, (r) => getAuth().handler(r));
  } catch {
    return Response.json(
      { message: "Authentication request could not be completed." },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST };
