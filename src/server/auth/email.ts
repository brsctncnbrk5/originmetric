export interface AuthEmail {
  kind: "verification" | "password-reset";
  to: string;
  url: string;
}
/** Implement with a configured provider later. Never log URLs/tokens or simulate delivery. */
export interface AuthEmailSender {
  send(message: AuthEmail): Promise<void>;
}
export class EmailUnavailable extends Error {
  constructor() {
    super("Email delivery is not configured. Contact the administrator.");
  }
}
export async function deliverAuthEmail(sender: AuthEmailSender | undefined, message: AuthEmail) {
  if (!sender) throw new EmailUnavailable();
  await sender.send(message);
}
