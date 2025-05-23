import type { Database } from "bun:sqlite";

export function errorMessage(...message: string[]): Response {
  console.error(message.join(" "));
  return new Response(message.join(" "), {
    status: 400,
    headers: { "Content-Type": "text/plain" },
  });
}

export function assertNever(value: never): never {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`,
  );
}

export async function getStringFormData(
  req: Request,
): Promise<ReadonlyMap<string, string>> {
  const formDataRaw = await req.formData();
  const data = new Map<string, string>();
  for (const [key, value] of formDataRaw) {
    if (typeof value === "string") {
      data.set(key, value);
    }
  }
  return data;
}

export type Context = {
  db: Database;
};

export type Handle = (req: Request, ctx: Context) => Promise<Response>;
