package variables

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Resolver ─────────────────────────────────────────────────────────────────

func TestResolver_SetGet(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "base_url", "https://api.example.com")

	v, ok := r.Get("base_url")
	require.True(t, ok)
	assert.Equal(t, "https://api.example.com", v)
}

func TestResolver_Get_NotFound(t *testing.T) {
	r := NewResolver()
	_, ok := r.Get("unknown")
	assert.False(t, ok)
}

func TestResolver_ScopePriority(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeGlobal, "token", "global-token")
	r.Set(ScopeEnvironment, "token", "env-token")
	r.Set(ScopeLocal, "token", "local-token")

	// Local wins over Environment and Global
	v, ok := r.Get("token")
	require.True(t, ok)
	assert.Equal(t, "local-token", v)
}

func TestResolver_ScopePriority_AllScopes(t *testing.T) {
	tests := []struct {
		name     string
		scopes   []Scope
		expected string
	}{
		{"local beats all", []Scope{ScopeGlobal, ScopeCollection, ScopeEnvironment, ScopeData, ScopeLocal}, "local-token"},
		{"data beats env/collection/global", []Scope{ScopeGlobal, ScopeCollection, ScopeEnvironment, ScopeData}, "data-token"},
		{"env beats collection/global", []Scope{ScopeGlobal, ScopeCollection, ScopeEnvironment}, "env-token"},
		{"collection beats global", []Scope{ScopeGlobal, ScopeCollection}, "collection-token"},
		{"global alone", []Scope{ScopeGlobal}, "global-token"},
	}

	values := map[Scope]string{
		ScopeLocal:       "local-token",
		ScopeData:        "data-token",
		ScopeEnvironment: "env-token",
		ScopeCollection:  "collection-token",
		ScopeGlobal:      "global-token",
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := NewResolver()
			for _, scope := range tc.scopes {
				r.Set(scope, "token", values[scope])
			}
			v, ok := r.Get("token")
			require.True(t, ok)
			assert.Equal(t, tc.expected, v)
		})
	}
}

func TestResolver_Resolve_Recursive(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "scheme", "https")
	r.Set(ScopeEnvironment, "host", "api.example.com")
	r.Set(ScopeEnvironment, "base_url", "{{scheme}}://{{host}}")

	result := r.Resolve("{{base_url}}/users")
	assert.Equal(t, "https://api.example.com/users", result)
}

func TestResolver_Resolve_Recursive_Deep(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "proto", "https")
	r.Set(ScopeEnvironment, "origin", "{{proto}}://api.example.com")
	r.Set(ScopeEnvironment, "base", "{{origin}}/v1")

	result := r.Resolve("{{base}}/users")
	assert.Equal(t, "https://api.example.com/v1/users", result)
}

func TestResolver_Resolve_Circular(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "a", "{{b}}")
	r.Set(ScopeEnvironment, "b", "{{a}}")

	// Must not loop forever; unresolvable refs stay as-is.
	result := r.Resolve("{{a}}")
	assert.NotEmpty(t, result)
}

func TestResolver_Resolve_Simple(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "base_url", "https://api.example.com")

	result := r.Resolve("{{base_url}}/articles")
	assert.Equal(t, "https://api.example.com/articles", result)
}

func TestResolver_Resolve_Multiple(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "host", "api.example.com")
	r.Set(ScopeEnvironment, "version", "v2")

	result := r.Resolve("https://{{host}}/{{version}}/users")
	assert.Equal(t, "https://api.example.com/v2/users", result)
}

func TestResolver_Resolve_UnknownLeftUnchanged(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{unknown_var}}/path")
	assert.Equal(t, "{{unknown_var}}/path", result)
}

func TestResolver_Resolve_NoVariables(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("https://api.example.com/path")
	assert.Equal(t, "https://api.example.com/path", result)
}

func TestResolver_Resolve_EmptyString(t *testing.T) {
	r := NewResolver()
	assert.Equal(t, "", r.Resolve(""))
}

// ── Dynamic variables ─────────────────────────────────────────────────────────

func TestResolver_Resolve_GUID(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("id-{{$guid}}")
	// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	assert.Len(t, result, len("id-")+36)
	assert.Contains(t, result, "-")
}

func TestResolver_Resolve_Timestamp(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{$timestamp}}")
	assert.NotEmpty(t, result)
	assert.NotContains(t, result, "{{")
}

func TestResolver_Resolve_IsoTimestamp(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{$isoTimestamp}}")
	assert.NotEmpty(t, result)
	assert.Contains(t, result, "T")
	assert.Contains(t, result, "Z")
}

func TestResolver_Resolve_RandomInt(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{$randomInt}}")
	assert.NotEmpty(t, result)
	assert.NotContains(t, result, "{{")
}

func TestResolver_Resolve_RandomBoolean(t *testing.T) {
	r := NewResolver()
	// Run several times to hit both branches
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		seen[r.Resolve("{{$randomBoolean}}")] = true
	}
	assert.True(t, seen["true"])
	assert.True(t, seen["false"])
}

func TestResolver_Resolve_RandomEmail(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{$randomEmail}}")
	assert.Contains(t, result, "@")
	assert.Contains(t, result, ".com")
}

func TestResolver_Resolve_UnknownDynamic(t *testing.T) {
	r := NewResolver()
	result := r.Resolve("{{$unknownDynamic}}")
	assert.Equal(t, "{{$unknownDynamic}}", result)
}

func TestResolver_Resolve_AllDynamicVars(t *testing.T) {
	r := NewResolver()
	vars := []string{
		"$guid", "$timestamp", "$isoTimestamp", "$randomInt", "$randomBoolean",
		"$randomAlphaNumeric", "$randomFirstName", "$randomLastName",
		"$randomFullName", "$randomEmail", "$randomUserName", "$randomDomainName",
		"$randomUrl", "$randomWord", "$randomWords", "$randomPhoneNumber",
		"$randomPassword",
	}
	for _, v := range vars {
		t.Run(v, func(t *testing.T) {
			result := r.Resolve("{{" + v + "}}")
			assert.NotContains(t, result, "{{", "dynamic var %s was not resolved", v)
			assert.NotEmpty(t, result)
		})
	}
}

func TestResolver_Resolve_MixedKnownUnknown(t *testing.T) {
	r := NewResolver()
	r.Set(ScopeEnvironment, "host", "api.example.com")
	result := r.Resolve("https://{{host}}/{{missing}}/{{$timestamp}}")
	assert.True(t, strings.HasPrefix(result, "https://api.example.com/{{missing}}/"))
	assert.NotContains(t, result[len("https://api.example.com/{{missing}}/"):], "{{")
}
