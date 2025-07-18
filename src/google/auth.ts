import { type Context, errorMessage, getStringFormData } from "../util.ts";

function formInput([name, value]: [name: string, value: string]): string {
  return `<input type="hidden" name="${name}" value="${value}" />`;
}

function handleGet(req: Request): Response {
  const searchParams = new URL(req.url).searchParams;

  const paramInputs = searchParams.entries().map(formInput);
  const paramInputsStr = Array.from(paramInputs).join("\n");

  const responseType = searchParams.get("response_type");
  if (responseType !== "code") {
    return errorMessage(
      `Invalid response_type: "${responseType}".`,
      `Expected "code".`,
    );
  }

  const loginForm = `
    <html lang="en">
      <head>
        <title>Google Login</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <form method="post">
          ${paramInputsStr}
          <label for="id_token_sub">sub</label>
          <input type="text" name="id_token_sub" id="id_token_sub" maxlength="255" required pattern="+" />
          <button>Submit</button>
        </form>
      </body>
    </html>
  `;
  return new Response(loginForm, {
    headers: {
      "content-type": "text/html",
    },
  });
}

async function handlePost(req: Request, { db }: Context): Promise<Response> {
  const formData = await getStringFormData(req);

  const redirectUri = formData.get("redirect_uri") ?? null;
  if (redirectUri === null) {
    return errorMessage("Parameter redirect_uri is required.");
  }

  const code = crypto.randomUUID();

  try {
    db.query(
      `INSERT INTO google_auth_session (code, client_id, redirect_uri, scope, sub, code_challenge_method, code_challenge)
       VALUES ($code, $clientId, $redirectUri, $scope, $sub, $codeChallengeMethod, $codeChallengeValue)`,
    ).run({
      code,
      redirectUri,
      clientId: formData.get("client_id") ?? null,
      scope: formData.get("scope") ?? null,
      sub: formData.get("id_token_sub") ?? null,
      codeChallengeMethod: formData.get("code_challenge_method") ?? null,
      codeChallengeValue: formData.get("code_challenge") ?? null,
    });
  } catch (err) {
    console.error(err);
    return errorMessage("Failed to store login session.");
  }

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);

  for (const key of ["state", "scope", "prompt"]) {
    const value = formData.get(key);
    if (value !== undefined) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  return new Response(null, {
    status: 303,
    headers: { Location: redirectUrl.toString() },
  });
}

export async function handle(req: Request, ctx: Context): Promise<Response> {
  if (req.method === "GET") {
    return handleGet(req);
  }

  if (req.method === "POST") {
    return await handlePost(req, ctx);
  }

  return new Response("Method Not Allowed", { status: 405 });
}
