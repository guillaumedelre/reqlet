import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AuthConfig } from "@/types"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 text-xs flex-1"
    />
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-7 text-xs flex-1"
    />
  )
}

interface AuthPanelProps {
  auth: AuthConfig
  onChange: (a: AuthConfig) => void
  /** Hide "Inherit auth from parent" for top-level collections */
  hideInherit?: boolean
}

export function AuthPanel({ auth, onChange, hideInherit = false }: AuthPanelProps) {
  return (
    <div className="p-3 space-y-3">
      {/* Type selector */}
      <Row label="Type">
        <Select
          value={auth.type}
          onValueChange={(v) => onChange({ ...auth, type: v as AuthConfig["type"] })}
        >
          <SelectTrigger className="h-7 text-xs w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!hideInherit && (
              <SelectItem value="inherit" className="text-xs">
                Inherit auth from parent
              </SelectItem>
            )}
            <SelectItem value="none" className="text-xs">
              No Auth
            </SelectItem>
            <SelectItem value="basic" className="text-xs">
              Basic Auth
            </SelectItem>
            <SelectItem value="bearer" className="text-xs">
              Bearer Token
            </SelectItem>
            <SelectItem value="jwt" className="text-xs">
              JWT Bearer
            </SelectItem>
            <SelectItem value="digest" className="text-xs">
              Digest Auth
            </SelectItem>
            <SelectItem value="oauth1" className="text-xs">
              OAuth 1.0
            </SelectItem>
            <SelectItem value="oauth2" className="text-xs">
              OAuth 2.0
            </SelectItem>
            <SelectItem value="hawk" className="text-xs">
              Hawk Authentication
            </SelectItem>
            <SelectItem value="aws-signature" className="text-xs">
              AWS Signature
            </SelectItem>
            <SelectItem value="ntlm" className="text-xs">
              NTLM Authentication
            </SelectItem>
            <SelectItem value="api-key" className="text-xs">
              API Key
            </SelectItem>
            <SelectItem value="akamai-edgegrid" className="text-xs">
              Akamai EdgeGrid
            </SelectItem>
            <SelectItem value="asap" className="text-xs">
              ASAP (Atlassian)
            </SelectItem>
          </SelectContent>
        </Select>
      </Row>

      {/* inherit / none */}
      {(auth.type === "inherit" || auth.type === "none") && (
        <p className="text-xs text-muted-foreground">
          {auth.type === "inherit"
            ? "Authorization will be inherited from the parent collection or folder."
            : "No authorization will be sent with this request."}
        </p>
      )}

      {/* Bearer Token */}
      {auth.type === "bearer" && (
        <Row label="Token">
          <TextInput
            value={auth.bearer?.token ?? ""}
            onChange={(v) => onChange({ ...auth, bearer: { token: v } })}
            placeholder="{{accessToken}}"
          />
        </Row>
      )}

      {/* Basic Auth */}
      {auth.type === "basic" && (
        <>
          <Row label="Username">
            <TextInput
              value={auth.basic?.username ?? ""}
              onChange={(v) =>
                onChange({ ...auth, basic: { username: v, password: auth.basic?.password ?? "" } })
              }
            />
          </Row>
          <Row label="Password">
            <PasswordInput
              value={auth.basic?.password ?? ""}
              onChange={(v) =>
                onChange({ ...auth, basic: { username: auth.basic?.username ?? "", password: v } })
              }
            />
          </Row>
        </>
      )}

      {/* JWT Bearer */}
      {auth.type === "jwt" && (
        <>
          <Row label="Algorithm">
            <Select
              value={auth.jwt?.algorithm ?? "HS256"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  jwt: {
                    ...auth.jwt!,
                    algorithm: v,
                    secret: auth.jwt?.secret ?? "",
                    payload: auth.jwt?.payload ?? "{}",
                    addTo: auth.jwt?.addTo ?? "header",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "HS256",
                  "HS384",
                  "HS512",
                  "RS256",
                  "RS384",
                  "RS512",
                  "ES256",
                  "ES384",
                  "ES512",
                  "PS256",
                  "PS384",
                  "PS512",
                ].map((a) => (
                  <SelectItem key={a} value={a} className="text-xs">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Secret / Key">
            <Textarea
              value={auth.jwt?.secret ?? ""}
              onChange={(e) =>
                onChange({
                  ...auth,
                  jwt: {
                    algorithm: auth.jwt?.algorithm ?? "HS256",
                    secret: e.target.value,
                    payload: auth.jwt?.payload ?? "{}",
                    addTo: auth.jwt?.addTo ?? "header",
                  },
                })
              }
              placeholder="{{jwtSecret}}"
              className="text-xs font-mono min-h-[60px]"
            />
          </Row>
          <Row label="Payload">
            <Textarea
              value={auth.jwt?.payload ?? "{}"}
              onChange={(e) =>
                onChange({
                  ...auth,
                  jwt: {
                    algorithm: auth.jwt?.algorithm ?? "HS256",
                    secret: auth.jwt?.secret ?? "",
                    payload: e.target.value,
                    addTo: auth.jwt?.addTo ?? "header",
                  },
                })
              }
              placeholder='{"sub": "user"}'
              className="text-xs font-mono min-h-[60px]"
            />
          </Row>
          <Row label="Add to">
            <Select
              value={auth.jwt?.addTo ?? "header"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  jwt: {
                    ...auth.jwt!,
                    algorithm: auth.jwt?.algorithm ?? "HS256",
                    secret: auth.jwt?.secret ?? "",
                    payload: auth.jwt?.payload ?? "{}",
                    addTo: v as "header" | "query",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header" className="text-xs">
                  Header
                </SelectItem>
                <SelectItem value="query" className="text-xs">
                  Query Param
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {/* Digest Auth */}
      {auth.type === "digest" && (
        <>
          <Row label="Username">
            <TextInput
              value={auth.digest?.username ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  digest: { username: v, password: auth.digest?.password ?? "" },
                })
              }
            />
          </Row>
          <Row label="Password">
            <PasswordInput
              value={auth.digest?.password ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  digest: { username: auth.digest?.username ?? "", password: v },
                })
              }
            />
          </Row>
        </>
      )}

      {/* OAuth 1.0 */}
      {auth.type === "oauth1" && (
        <>
          <Row label="Consumer Key">
            <TextInput
              value={auth.oauth1?.consumerKey ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  oauth1: {
                    ...auth.oauth1!,
                    consumerKey: v,
                    consumerSecret: auth.oauth1?.consumerSecret ?? "",
                    token: auth.oauth1?.token ?? "",
                    tokenSecret: auth.oauth1?.tokenSecret ?? "",
                    signatureMethod: auth.oauth1?.signatureMethod ?? "HMAC-SHA1",
                  },
                })
              }
              placeholder="{{consumerKey}}"
            />
          </Row>
          <Row label="Consumer Secret">
            <PasswordInput
              value={auth.oauth1?.consumerSecret ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  oauth1: {
                    ...auth.oauth1!,
                    consumerKey: auth.oauth1?.consumerKey ?? "",
                    consumerSecret: v,
                    token: auth.oauth1?.token ?? "",
                    tokenSecret: auth.oauth1?.tokenSecret ?? "",
                    signatureMethod: auth.oauth1?.signatureMethod ?? "HMAC-SHA1",
                  },
                })
              }
              placeholder="{{consumerSecret}}"
            />
          </Row>
          <Row label="Access Token">
            <TextInput
              value={auth.oauth1?.token ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  oauth1: {
                    ...auth.oauth1!,
                    consumerKey: auth.oauth1?.consumerKey ?? "",
                    consumerSecret: auth.oauth1?.consumerSecret ?? "",
                    token: v,
                    tokenSecret: auth.oauth1?.tokenSecret ?? "",
                    signatureMethod: auth.oauth1?.signatureMethod ?? "HMAC-SHA1",
                  },
                })
              }
              placeholder="{{accessToken}}"
            />
          </Row>
          <Row label="Token Secret">
            <PasswordInput
              value={auth.oauth1?.tokenSecret ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  oauth1: {
                    ...auth.oauth1!,
                    consumerKey: auth.oauth1?.consumerKey ?? "",
                    consumerSecret: auth.oauth1?.consumerSecret ?? "",
                    token: auth.oauth1?.token ?? "",
                    tokenSecret: v,
                    signatureMethod: auth.oauth1?.signatureMethod ?? "HMAC-SHA1",
                  },
                })
              }
              placeholder="{{tokenSecret}}"
            />
          </Row>
          <Row label="Signature">
            <Select
              value={auth.oauth1?.signatureMethod ?? "HMAC-SHA1"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  oauth1: {
                    ...auth.oauth1!,
                    consumerKey: auth.oauth1?.consumerKey ?? "",
                    consumerSecret: auth.oauth1?.consumerSecret ?? "",
                    token: auth.oauth1?.token ?? "",
                    tokenSecret: auth.oauth1?.tokenSecret ?? "",
                    signatureMethod: v,
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["HMAC-SHA1", "HMAC-SHA256", "RSA-SHA1", "PLAINTEXT"].map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {/* OAuth 2.0 */}
      {auth.type === "oauth2" && (
        <>
          <Row label="Grant Type">
            <Select
              value={auth.oauth2?.grantType ?? "authorization_code"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2!,
                    grantType: v,
                    accessToken: auth.oauth2?.accessToken ?? "",
                    tokenType: auth.oauth2?.tokenType ?? "Bearer",
                    addTokenTo: auth.oauth2?.addTokenTo ?? "header",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="authorization_code" className="text-xs">
                  Authorization Code
                </SelectItem>
                <SelectItem value="implicit" className="text-xs">
                  Implicit
                </SelectItem>
                <SelectItem value="client_credentials" className="text-xs">
                  Client Credentials
                </SelectItem>
                <SelectItem value="password" className="text-xs">
                  Password
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Access Token">
            <TextInput
              value={auth.oauth2?.accessToken ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2!,
                    grantType: auth.oauth2?.grantType ?? "authorization_code",
                    accessToken: v,
                    tokenType: auth.oauth2?.tokenType ?? "Bearer",
                    addTokenTo: auth.oauth2?.addTokenTo ?? "header",
                  },
                })
              }
              placeholder="{{accessToken}}"
            />
          </Row>
          <Row label="Token Type">
            <Select
              value={auth.oauth2?.tokenType ?? "Bearer"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2!,
                    grantType: auth.oauth2?.grantType ?? "authorization_code",
                    accessToken: auth.oauth2?.accessToken ?? "",
                    tokenType: v,
                    addTokenTo: auth.oauth2?.addTokenTo ?? "header",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bearer" className="text-xs">
                  Bearer
                </SelectItem>
                <SelectItem value="MAC" className="text-xs">
                  MAC
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Add to">
            <Select
              value={auth.oauth2?.addTokenTo ?? "header"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  oauth2: {
                    ...auth.oauth2!,
                    grantType: auth.oauth2?.grantType ?? "authorization_code",
                    accessToken: auth.oauth2?.accessToken ?? "",
                    tokenType: auth.oauth2?.tokenType ?? "Bearer",
                    addTokenTo: v as "header" | "query",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header" className="text-xs">
                  Header
                </SelectItem>
                <SelectItem value="query" className="text-xs">
                  Query Param
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {/* Hawk */}
      {auth.type === "hawk" && (
        <>
          <Row label="Auth ID">
            <TextInput
              value={auth.hawk?.authId ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  hawk: {
                    ...auth.hawk!,
                    authId: v,
                    authKey: auth.hawk?.authKey ?? "",
                    algorithm: auth.hawk?.algorithm ?? "sha256",
                  },
                })
              }
              placeholder="{{hawkId}}"
            />
          </Row>
          <Row label="Auth Key">
            <PasswordInput
              value={auth.hawk?.authKey ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  hawk: {
                    ...auth.hawk!,
                    authId: auth.hawk?.authId ?? "",
                    authKey: v,
                    algorithm: auth.hawk?.algorithm ?? "sha256",
                  },
                })
              }
              placeholder="{{hawkKey}}"
            />
          </Row>
          <Row label="Algorithm">
            <Select
              value={auth.hawk?.algorithm ?? "sha256"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  hawk: {
                    authId: auth.hawk?.authId ?? "",
                    authKey: auth.hawk?.authKey ?? "",
                    algorithm: v,
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sha256" className="text-xs">
                  SHA-256
                </SelectItem>
                <SelectItem value="sha1" className="text-xs">
                  SHA-1
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {/* AWS Signature */}
      {auth.type === "aws-signature" && (
        <>
          <Row label="Access Key">
            <TextInput
              value={auth.awsSignature?.accessKey ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  awsSignature: {
                    ...auth.awsSignature!,
                    accessKey: v,
                    secretKey: auth.awsSignature?.secretKey ?? "",
                    region: auth.awsSignature?.region ?? "",
                    service: auth.awsSignature?.service ?? "",
                  },
                })
              }
              placeholder="{{awsAccessKey}}"
            />
          </Row>
          <Row label="Secret Key">
            <PasswordInput
              value={auth.awsSignature?.secretKey ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  awsSignature: {
                    ...auth.awsSignature!,
                    accessKey: auth.awsSignature?.accessKey ?? "",
                    secretKey: v,
                    region: auth.awsSignature?.region ?? "",
                    service: auth.awsSignature?.service ?? "",
                  },
                })
              }
              placeholder="{{awsSecretKey}}"
            />
          </Row>
          <Row label="Region">
            <TextInput
              value={auth.awsSignature?.region ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  awsSignature: {
                    ...auth.awsSignature!,
                    accessKey: auth.awsSignature?.accessKey ?? "",
                    secretKey: auth.awsSignature?.secretKey ?? "",
                    region: v,
                    service: auth.awsSignature?.service ?? "",
                  },
                })
              }
              placeholder="us-east-1"
            />
          </Row>
          <Row label="Service">
            <TextInput
              value={auth.awsSignature?.service ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  awsSignature: {
                    ...auth.awsSignature!,
                    accessKey: auth.awsSignature?.accessKey ?? "",
                    secretKey: auth.awsSignature?.secretKey ?? "",
                    region: auth.awsSignature?.region ?? "",
                    service: v,
                  },
                })
              }
              placeholder="execute-api"
            />
          </Row>
          <Row label="Session Token">
            <TextInput
              value={auth.awsSignature?.sessionToken ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  awsSignature: {
                    ...auth.awsSignature!,
                    accessKey: auth.awsSignature?.accessKey ?? "",
                    secretKey: auth.awsSignature?.secretKey ?? "",
                    region: auth.awsSignature?.region ?? "",
                    service: auth.awsSignature?.service ?? "",
                    sessionToken: v || undefined,
                  },
                })
              }
              placeholder="Optional"
            />
          </Row>
        </>
      )}

      {/* NTLM */}
      {auth.type === "ntlm" && (
        <>
          <Row label="Username">
            <TextInput
              value={auth.ntlm?.username ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  ntlm: { ...auth.ntlm!, username: v, password: auth.ntlm?.password ?? "" },
                })
              }
            />
          </Row>
          <Row label="Password">
            <PasswordInput
              value={auth.ntlm?.password ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  ntlm: { ...auth.ntlm!, username: auth.ntlm?.username ?? "", password: v },
                })
              }
            />
          </Row>
          <Row label="Domain">
            <TextInput
              value={auth.ntlm?.domain ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  ntlm: {
                    ...auth.ntlm!,
                    username: auth.ntlm?.username ?? "",
                    password: auth.ntlm?.password ?? "",
                    domain: v || undefined,
                  },
                })
              }
              placeholder="Optional"
            />
          </Row>
          <Row label="Workstation">
            <TextInput
              value={auth.ntlm?.workstation ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  ntlm: {
                    ...auth.ntlm!,
                    username: auth.ntlm?.username ?? "",
                    password: auth.ntlm?.password ?? "",
                    workstation: v || undefined,
                  },
                })
              }
              placeholder="Optional"
            />
          </Row>
        </>
      )}

      {/* API Key */}
      {auth.type === "api-key" && (
        <>
          <Row label="Key">
            <TextInput
              value={auth.apiKey?.key ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  apiKey: {
                    ...auth.apiKey!,
                    key: v,
                    value: auth.apiKey?.value ?? "",
                    addTo: auth.apiKey?.addTo ?? "header",
                  },
                })
              }
              placeholder="X-API-Key"
            />
          </Row>
          <Row label="Value">
            <TextInput
              value={auth.apiKey?.value ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  apiKey: {
                    ...auth.apiKey!,
                    key: auth.apiKey?.key ?? "",
                    value: v,
                    addTo: auth.apiKey?.addTo ?? "header",
                  },
                })
              }
              placeholder="{{apiKey}}"
            />
          </Row>
          <Row label="Add to">
            <Select
              value={auth.apiKey?.addTo ?? "header"}
              onValueChange={(v) =>
                onChange({
                  ...auth,
                  apiKey: {
                    ...auth.apiKey!,
                    key: auth.apiKey?.key ?? "",
                    value: auth.apiKey?.value ?? "",
                    addTo: v as "header" | "query",
                  },
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header" className="text-xs">
                  Header
                </SelectItem>
                <SelectItem value="query" className="text-xs">
                  Query Param
                </SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {/* Akamai EdgeGrid */}
      {auth.type === "akamai-edgegrid" && (
        <>
          <Row label="Access Token">
            <TextInput
              value={auth.akamaiEdgegrid?.accessToken ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  akamaiEdgegrid: {
                    ...auth.akamaiEdgegrid!,
                    accessToken: v,
                    clientToken: auth.akamaiEdgegrid?.clientToken ?? "",
                    clientSecret: auth.akamaiEdgegrid?.clientSecret ?? "",
                    baseUrl: auth.akamaiEdgegrid?.baseUrl ?? "",
                  },
                })
              }
              placeholder="{{accessToken}}"
            />
          </Row>
          <Row label="Client Token">
            <TextInput
              value={auth.akamaiEdgegrid?.clientToken ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  akamaiEdgegrid: {
                    ...auth.akamaiEdgegrid!,
                    accessToken: auth.akamaiEdgegrid?.accessToken ?? "",
                    clientToken: v,
                    clientSecret: auth.akamaiEdgegrid?.clientSecret ?? "",
                    baseUrl: auth.akamaiEdgegrid?.baseUrl ?? "",
                  },
                })
              }
              placeholder="{{clientToken}}"
            />
          </Row>
          <Row label="Client Secret">
            <PasswordInput
              value={auth.akamaiEdgegrid?.clientSecret ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  akamaiEdgegrid: {
                    ...auth.akamaiEdgegrid!,
                    accessToken: auth.akamaiEdgegrid?.accessToken ?? "",
                    clientToken: auth.akamaiEdgegrid?.clientToken ?? "",
                    clientSecret: v,
                    baseUrl: auth.akamaiEdgegrid?.baseUrl ?? "",
                  },
                })
              }
              placeholder="{{clientSecret}}"
            />
          </Row>
          <Row label="Base URL">
            <TextInput
              value={auth.akamaiEdgegrid?.baseUrl ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  akamaiEdgegrid: {
                    ...auth.akamaiEdgegrid!,
                    accessToken: auth.akamaiEdgegrid?.accessToken ?? "",
                    clientToken: auth.akamaiEdgegrid?.clientToken ?? "",
                    clientSecret: auth.akamaiEdgegrid?.clientSecret ?? "",
                    baseUrl: v,
                  },
                })
              }
              placeholder="https://akab-xxx.luna.akamaiapis.net"
            />
          </Row>
        </>
      )}

      {/* ASAP (Atlassian) */}
      {auth.type === "asap" && (
        <>
          <Row label="Issuer">
            <TextInput
              value={auth.asap?.issuer ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  asap: {
                    ...auth.asap!,
                    issuer: v,
                    audience: auth.asap?.audience ?? "",
                    keyId: auth.asap?.keyId ?? "",
                    privateKey: auth.asap?.privateKey ?? "",
                  },
                })
              }
              placeholder="{{issuer}}"
            />
          </Row>
          <Row label="Audience">
            <TextInput
              value={auth.asap?.audience ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  asap: {
                    ...auth.asap!,
                    issuer: auth.asap?.issuer ?? "",
                    audience: v,
                    keyId: auth.asap?.keyId ?? "",
                    privateKey: auth.asap?.privateKey ?? "",
                  },
                })
              }
              placeholder="{{audience}}"
            />
          </Row>
          <Row label="Key ID">
            <TextInput
              value={auth.asap?.keyId ?? ""}
              onChange={(v) =>
                onChange({
                  ...auth,
                  asap: {
                    ...auth.asap!,
                    issuer: auth.asap?.issuer ?? "",
                    audience: auth.asap?.audience ?? "",
                    keyId: v,
                    privateKey: auth.asap?.privateKey ?? "",
                  },
                })
              }
              placeholder="{{keyId}}"
            />
          </Row>
          <Row label="Private Key">
            <Textarea
              value={auth.asap?.privateKey ?? ""}
              onChange={(e) =>
                onChange({
                  ...auth,
                  asap: {
                    ...auth.asap!,
                    issuer: auth.asap?.issuer ?? "",
                    audience: auth.asap?.audience ?? "",
                    keyId: auth.asap?.keyId ?? "",
                    privateKey: e.target.value,
                  },
                })
              }
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
              className="text-xs font-mono min-h-[80px]"
            />
          </Row>
        </>
      )}
    </div>
  )
}
