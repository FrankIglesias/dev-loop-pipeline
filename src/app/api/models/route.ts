export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const providerParam = url.searchParams.get('provider') ?? 'lmstudio';
  const baseUrl = url.searchParams.get('baseUrl');

  try {
    const endpoint = baseUrl ?? 'http://localhost:1234/v1';
    const apiUrl = `${endpoint}/models`;
    const res = await fetch(apiUrl);
    const data = (await res.json()) as Record<string, unknown>;
    const models: string[] = ((data.data as Array<{ id: string }>) ?? []).map((m) => m.id);
    return new Response(JSON.stringify({ models }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ models: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
