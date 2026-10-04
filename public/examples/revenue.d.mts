export function sendTestPayment(
  payment: { eventId: string; customerId: string; visitorId: string | null; occurredAt: string },
  env?: Record<string, string | undefined>,
): Promise<{ status: string; attribution: { status: string; source: string | null } }>;
