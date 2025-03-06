import { type Context, errorMessage } from "../util.ts";

function generateGoogleIdToken(
  clientId: string,
  sub: string | null,
  scopes: string[],
): string | undefined | Response {
  if (!scopes.includes("openid")) {
    return undefined;
  }

  if (sub === null) {
    return errorMessage("sub is required for openid scope.");
  }

  const payload = {
    aud: clientId,
    exp: Date.now() + 3600,
    iat: Date.now(),
    iss: "https://accounts.google.com",
    sub,
  };

  const payloadStr = new TextEncoder()
    .encode(JSON.stringify(payload))
    .toBase64({ alphabet: "base64url" });

  const header = { alg: "HS256", typ: "JWT" };

  const headerStr = new TextEncoder()
    .encode(JSON.stringify(header))
    .toBase64({ alphabet: "base64url" });

  const signatureContent = `${headerStr}.${payloadStr}`;

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(signatureContent);
  const signature = hasher.digest("base64url");

  return `${headerStr}.${payloadStr}.${signature}`;
}

export async function handle(req: Request, ctx: Context): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const path = new URL(req.url).pathname;
  if (path !== "/token") {
    return new Response(null, { status: 404 });
  }

  const formData = await req.formData();

  const grantType = formData.get("grant_type");

  if (grantType === null) {
    return errorMessage("Parameter grant_type is required.");
  }

  if (grantType !== "authorization_code") {
    return errorMessage(
      `Invalid grant_type: "${grantType}".`,
      `Expected "authorization_code".`,
    );
  }

  const code = formData.get("code");

  if (code === null) {
    return errorMessage("Parameter code is required.");
  }

  if (code instanceof File) {
    return errorMessage('Invalid code type: "file". Expected "string".');
  }

  const authSession = ctx.db
    .query("SELECT * FROM auth_session WHERE code = $code")
    .get({ code });

  if (authSession === null) {
    return errorMessage(`Auth session not found for code: "${code}".`);
  }

  if (typeof authSession !== "object") {
    return new Response(null, { status: 500 });
  }

  ctx.db.query("DELETE FROM auth_session WHERE code = $code").run({ code });

  const codeChallengeValue =
    "code_challenge_value" in authSession &&
    typeof authSession.code_challenge_value === "string"
      ? authSession.code_challenge_value
      : null;

  const codeChallengeMethod =
    "code_challenge_method" in authSession &&
    typeof authSession.code_challenge_method === "string"
      ? authSession.code_challenge_method
      : null;

  if (codeChallengeValue !== null) {
    if (codeChallengeMethod !== "S256") {
      return errorMessage("Code challenge plain is currently not supported.");
    }

    const codeVerifier = formData.get("code_verifier");

    if (codeVerifier === null) {
      return errorMessage("Parameter code_verifier is required.");
    }

    if (codeVerifier instanceof File) {
      return errorMessage(
        'Invalid code_verifier type: "file". Expected "string".',
      );
    }

    const codeChallengeBytes = new TextEncoder().encode(codeVerifier);
    const codeChallengeHash = await crypto.subtle.digest(
      "SHA-256",
      codeChallengeBytes,
    );
    const expectedCodeChallenge = new Uint8Array(codeChallengeHash).toBase64({
      alphabet: "base64url",
      omitPadding: true,
    });

    if (expectedCodeChallenge !== codeChallengeValue) {
      return errorMessage(
        "Hash of code_verifier does not match code_challenge.",
      );
    }
  }

  const redirectUri =
    "redirect_uri" in authSession &&
    typeof authSession.redirect_uri === "string"
      ? authSession.redirect_uri
      : null;
  if (formData.get("redirect_uri") !== redirectUri) {
    return errorMessage("Invalid redirect_uri.");
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader === null) {
    return errorMessage("Authorization header is required.");
  }

  const [prefix, credentials] = authHeader.split(" ");
  if (prefix !== "Basic") {
    return errorMessage(
      `Invalid Authorization header prefix: "${prefix}".`,
      `Expected "Basic".`,
    );
  }

  if (credentials === undefined) {
    return errorMessage("Credentials not found in Authorization header.");
  }

  const [clientId, clientSecret] = atob(credentials).split(":");

  const authSessionClientId =
    "client_id" in authSession && typeof authSession.client_id === "string"
      ? authSession.client_id
      : null;
  if (clientId !== authSessionClientId) {
    return errorMessage("Invalid client_id");
  }

  if (clientSecret !== "mock_client_secret") {
    return errorMessage(
      `Invalid client_secret. Expected "mock_client_secret".`,
      "Never use production client_secret in tests.",
    );
  }

  const sub =
    "sub" in authSession && typeof authSession.sub === "string"
      ? authSession.sub
      : null;

  const authSessionScope =
    "scope" in authSession && typeof authSession.scope === "string"
      ? authSession.scope
      : null;

  if (authSessionScope === null) {
    return errorMessage("scope is required.");
  }

  const scopes = authSessionScope?.split(" ") ?? [];

  const idToken = generateGoogleIdToken(clientId, sub, scopes);
  if (idToken instanceof Response) {
    return idToken;
  }

  const responseBody: Record<string, string | number | undefined> = {
    id_token: idToken,
    access_token: "mock_access_token",
    scope: authSessionScope ?? undefined,
    token_type: "Bearer",
    expires_in: 3600,
  };

  const cleanResponseBody = Object.fromEntries(
    Object.entries(responseBody).filter(([_, value]) => value !== undefined),
  );

  return new Response(JSON.stringify(cleanResponseBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
