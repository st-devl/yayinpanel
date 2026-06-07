import "server-only";

import { createHmac, randomBytes } from "node:crypto";

export type OAuth1Credentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

export type OAuth1HeaderInput = OAuth1Credentials & {
  method: string;
  url: string;
  bodyParams?: Array<[string, string]>;
  nonce?: string;
  timestamp?: string;
};

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function normalizeParameters(params: Array<[string, string]>) {
  return params
    .map(([key, value]) => [percentEncode(key), percentEncode(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function baseUrl(url: URL) {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

export function buildOAuth1AuthorizationHeader(input: OAuth1HeaderInput) {
  const url = new URL(input.url);
  const oauthParams: Array<[string, string]> = [
    ["oauth_consumer_key", input.consumerKey],
    ["oauth_nonce", input.nonce ?? randomBytes(16).toString("hex")],
    ["oauth_signature_method", "HMAC-SHA1"],
    [
      "oauth_timestamp",
      input.timestamp ?? Math.floor(Date.now() / 1000).toString()
    ],
    ["oauth_token", input.token],
    ["oauth_version", "1.0"]
  ];
  const queryParams = Array.from(url.searchParams.entries());
  const signatureParams = [
    ...oauthParams,
    ...queryParams,
    ...(input.bodyParams ?? [])
  ];
  const signatureBase = [
    input.method.toUpperCase(),
    baseUrl(url),
    normalizeParameters(signatureParams)
  ]
    .map(percentEncode)
    .join("&");
  const signingKey = `${percentEncode(input.consumerSecret)}&${percentEncode(
    input.tokenSecret
  )}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");
  const headerParams = [...oauthParams, ["oauth_signature", signature] as const]
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}
