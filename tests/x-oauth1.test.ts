import { describe, expect, it } from "vitest";
import { buildOAuth1AuthorizationHeader } from "@/lib/integrations/oauth1";

describe("OAuth 1.0a authorization header", () => {
  it("matches the RFC 5849 HMAC-SHA1 signature example", () => {
    const header = buildOAuth1AuthorizationHeader({
      consumerKey: "dpf43f3p2l4k3l03",
      consumerSecret: "kd94hf93k423kf44",
      method: "GET",
      nonce: "kllo9940pd9333jh",
      timestamp: "1191242096",
      token: "nnch734d00sl2jdk",
      tokenSecret: "pfkkdhi9sl3r4s00",
      url: "http://photos.example.net/photos?file=vacation.jpg&size=original"
    });

    expect(header).toContain('oauth_consumer_key="dpf43f3p2l4k3l03"');
    expect(header).toContain('oauth_nonce="kllo9940pd9333jh"');
    expect(header).toContain(
      'oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D"'
    );
  });
});
