// Package variables resolves Postman variable references across all scopes.
package variables

import "regexp"

// varPattern matches {{key}} references in strings.
var varPattern = regexp.MustCompile(`\{\{([^{}]+)\}\}`)

// Scope represents a Postman variable scope. Lower value = higher priority.
type Scope int

const (
	ScopeLocal       Scope = iota // set by pm.variables.set() in scripts
	ScopeData                     // injected from data files (CSV/JSON)
	ScopeEnvironment              // active environment
	ScopeCollection               // collection variables
	ScopeGlobal                   // global variables
)

// Resolver stores variables across all Postman scopes and resolves {{key}}
// references in strings, respecting scope priority.
type Resolver struct {
	scopes [5]map[string]string
}

// NewResolver creates an empty resolver.
func NewResolver() *Resolver {
	r := &Resolver{}
	for i := range r.scopes {
		r.scopes[i] = make(map[string]string)
	}
	return r
}

// Set stores a variable value in the given scope.
func (r *Resolver) Set(scope Scope, key, value string) {
	r.scopes[scope][key] = value
}

// Get returns the value of a variable, searching scopes from highest to lowest
// priority. Reports false if the variable is not found in any scope.
func (r *Resolver) Get(key string) (string, bool) {
	for _, s := range r.scopes {
		if v, ok := s[key]; ok {
			return v, true
		}
	}
	return "", false
}

// maxResolveDepth caps recursive variable expansion to break circular references.
const maxResolveDepth = 10

// Snapshot returns a shallow copy of all variables in the given scope.
func (r *Resolver) Snapshot(scope Scope) map[string]string {
	out := make(map[string]string, len(r.scopes[scope]))
	for k, v := range r.scopes[scope] {
		out[k] = v
	}
	return out
}

// ReplaceScope replaces the entire content of a scope with values.
func (r *Resolver) ReplaceScope(scope Scope, values map[string]string) {
	m := make(map[string]string, len(values))
	for k, v := range values {
		m[k] = v
	}
	r.scopes[scope] = m
}

// Resolve replaces every {{key}} in s with its value, recursively expanding
// variable values that themselves contain {{...}} references. Unknown variables
// are left unchanged. Dynamic variables ({{$name}}) are evaluated on each call.
// Circular references are broken after maxResolveDepth iterations.
func (r *Resolver) Resolve(s string) string {
	for range maxResolveDepth {
		next := varPattern.ReplaceAllStringFunc(s, func(match string) string {
			key := match[2 : len(match)-2]

			if len(key) > 0 && key[0] == '$' {
				if v, ok := resolveDynamic(key[1:]); ok {
					return v
				}
				return match
			}

			if v, ok := r.Get(key); ok {
				return v
			}
			return match
		})
		if next == s {
			break
		}
		s = next
	}
	return s
}
