export function startSaas(config: {
  snippet: string;
  env: { OM_URL: string; OM_SERVER_KEY: string };
}): Promise<{ url: string; close(): Promise<void> }>;
