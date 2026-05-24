package parser

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Version identifiers returned by DetectVersion.
const (
	VersionV21 = "v2.1"
	VersionV20 = "v2.0"
	VersionV10 = "v1.0"
)

// DetectVersion inspects raw collection JSON and returns the format version.
// v1.0 is identified by the presence of a root-level "requests" array.
// v2.0 and v2.1 are distinguished by the info.schema URL.
func DetectVersion(data []byte) (string, error) {
	var probe struct {
		Requests json.RawMessage `json:"requests"`
		Info     struct {
			Schema string `json:"schema"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return "", fmt.Errorf("detect version: %w", err)
	}

	// v1.0 has a root-level "requests" array instead of a schema URL.
	// Exclude explicit JSON null — only a real array signals v1.0.
	if len(probe.Requests) > 0 && string(probe.Requests) != "null" {
		return VersionV10, nil
	}

	switch {
	case strings.HasPrefix(probe.Info.Schema, SchemaV21):
		return VersionV21, nil
	case strings.HasPrefix(probe.Info.Schema, SchemaV20):
		return VersionV20, nil
	default:
		return "", fmt.Errorf("detect version: unknown schema %q", probe.Info.Schema)
	}
}
