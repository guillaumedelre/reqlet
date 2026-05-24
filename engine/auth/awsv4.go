package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	nethttp "net/http"
	"sort"
	"strings"
	"time"

	"github.com/guillaumedelre/reqlet/engine/parser"
	"github.com/guillaumedelre/reqlet/engine/variables"
)

const awsAlgorithm = "AWS4-HMAC-SHA256"

type awsv4 struct {
	accessKey    string
	secretKey    string
	region       string
	service      string
	sessionToken string
}

func newAWSV4(params []parser.AuthParam) (*awsv4, error) {
	accessKey := paramStr(params, "accessKey")
	if accessKey == "" {
		return nil, fmt.Errorf("awsv4: missing accessKey param")
	}
	secretKey := paramStr(params, "secretKey")
	if secretKey == "" {
		return nil, fmt.Errorf("awsv4: missing secretKey param")
	}
	region := paramStr(params, "region")
	if region == "" {
		return nil, fmt.Errorf("awsv4: missing region param")
	}
	service := paramStr(params, "service")
	if service == "" {
		return nil, fmt.Errorf("awsv4: missing service param")
	}
	return &awsv4{
		accessKey:    accessKey,
		secretKey:    secretKey,
		region:       region,
		service:      service,
		sessionToken: paramStr(params, "sessionToken"),
	}, nil
}

func (a *awsv4) Apply(_ context.Context, req *nethttp.Request, vars *variables.Resolver) error {
	accessKey := vars.Resolve(a.accessKey)
	secretKey := vars.Resolve(a.secretKey)
	region := vars.Resolve(a.region)
	service := vars.Resolve(a.service)
	sessionToken := vars.Resolve(a.sessionToken)

	now := time.Now().UTC()
	date := now.Format("20060102")
	datetime := now.Format("20060102T150405Z")

	// Read and hash the body.
	bodyHash, err := awsBodyHash(req)
	if err != nil {
		return fmt.Errorf("awsv4: hash body: %w", err)
	}

	req.Header.Set("x-amz-date", datetime)
	if sessionToken != "" {
		req.Header.Set("x-amz-security-token", sessionToken)
	}
	req.Header.Set("x-amz-content-sha256", bodyHash)

	// Canonical request.
	signedHeaders, canonicalHeaders := awsCanonicalHeaders(req)
	canonicalURI := awsCanonicalURI(req.URL.EscapedPath())
	canonicalQueryString := awsCanonicalQuery(req.URL.RawQuery)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		bodyHash,
	}, "\n")

	// String to sign.
	credentialScope := strings.Join([]string{date, region, service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		awsAlgorithm,
		datetime,
		credentialScope,
		awsSHA256Hex(canonicalRequest),
	}, "\n")

	// Signing key and signature.
	signingKey := awsDeriveKey(secretKey, date, region, service)
	signature := hex.EncodeToString(awsHMACSHA256(signingKey, stringToSign))

	req.Header.Set("Authorization", fmt.Sprintf(
		"%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		awsAlgorithm, accessKey, credentialScope, signedHeaders, signature,
	))
	return nil
}

func awsBodyHash(req *nethttp.Request) (string, error) {
	if req.Body == nil {
		return awsSHA256Hex(""), nil
	}
	if req.GetBody == nil {
		return awsSHA256Hex(""), nil
	}
	body, err := req.GetBody()
	if err != nil {
		return "", err
	}
	defer func() { _ = body.Close() }()
	b, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	return awsSHA256Hex(string(b)), nil
}

func awsCanonicalHeaders(req *nethttp.Request) (signedHeaders, canonicalHeaders string) {
	keys := make([]string, 0, len(req.Header)+1)
	headers := make(map[string]string, len(req.Header)+1)

	for k, vs := range req.Header {
		lower := strings.ToLower(k)
		keys = append(keys, lower)
		headers[lower] = strings.TrimSpace(strings.Join(vs, ","))
	}
	if _, ok := headers["host"]; !ok {
		keys = append(keys, "host")
		headers["host"] = req.Host
		if headers["host"] == "" {
			headers["host"] = req.URL.Host
		}
	}
	sort.Strings(keys)

	var sb strings.Builder
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteByte(':')
		sb.WriteString(headers[k])
		sb.WriteByte('\n')
	}
	return strings.Join(keys, ";"), sb.String()
}

func awsCanonicalURI(path string) string {
	if path == "" {
		return "/"
	}
	return path
}

func awsCanonicalQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}
	parts := strings.Split(rawQuery, "&")
	sort.Strings(parts)
	return strings.Join(parts, "&")
}

func awsSHA256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func awsHMACSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func awsDeriveKey(secretKey, date, region, service string) []byte {
	kDate := awsHMACSHA256([]byte("AWS4"+secretKey), date)
	kRegion := awsHMACSHA256(kDate, region)
	kService := awsHMACSHA256(kRegion, service)
	return awsHMACSHA256(kService, "aws4_request")
}
