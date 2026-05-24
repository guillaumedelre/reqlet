package migration

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/guillaumedelre/reqlet/engine/parser"
)

// ── V20ToV21 ────────────────────────────────────────────────────────────────

func TestV20ToV21_Schema(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "Test", Schema: parser.SchemaV20},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	assert.Equal(t, parser.SchemaV21, out.Info.Schema)
	assert.Equal(t, "Test", out.Info.Name)
}

func TestV20ToV21_NilAuth(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	assert.Nil(t, out.Auth)
}

func TestV20ToV21_BasicAuthObject(t *testing.T) {
	// v2.0 basic auth uses an object: {"username": "foo", "password": "bar"}
	basic, _ := json.Marshal(map[string]string{"username": "admin", "password": "s3cret"})
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Auth: &parser.AuthV20{
			Type:  parser.AuthTypeBasic,
			Basic: basic,
		},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	require.NotNil(t, out.Auth)
	assert.Equal(t, parser.AuthTypeBasic, out.Auth.Type)
	require.Len(t, out.Auth.Basic, 2)

	byKey := make(map[string]interface{}, 2)
	for _, p := range out.Auth.Basic {
		byKey[p.Key] = p.Value
	}
	assert.Equal(t, "admin", byKey["username"])
	assert.Equal(t, "s3cret", byKey["password"])
}

func TestV20ToV21_BasicAuthArray(t *testing.T) {
	// Mixed export: params already in v2.1 array form — should pass through unchanged.
	arr := []parser.AuthParam{
		{Key: "username", Value: "user", Type: "string"},
	}
	basic, _ := json.Marshal(arr)
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Auth: &parser.AuthV20{Type: parser.AuthTypeBasic, Basic: basic},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Auth.Basic, 1)
	assert.Equal(t, "username", out.Auth.Basic[0].Key)
}

func TestV20ToV21_NoAuthType(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Item: []parser.ItemV20{
			{
				Name: "req",
				Request: &parser.RequestV20{
					Auth:   &parser.AuthV20{Type: parser.AuthTypeNoAuth},
					Method: "GET",
					URL:    parser.URL{Raw: "https://example.com"},
				},
			},
		},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	req := out.Item[0].Request
	require.NotNil(t, req.Auth)
	assert.Equal(t, parser.AuthTypeNoAuth, req.Auth.Type)
}

func TestV20ToV21_NestedItems(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Item: []parser.ItemV20{
			{
				Name: "Folder",
				Item: []parser.ItemV20{
					{
						Name: "Inner",
						Request: &parser.RequestV20{
							Method: "GET",
							URL:    parser.URL{Raw: "https://example.com"},
						},
					},
				},
			},
		},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Item, 1)
	assert.True(t, out.Item[0].IsFolder())
	require.Len(t, out.Item[0].Item, 1)
	assert.Equal(t, "Inner", out.Item[0].Item[0].Name)
}

func TestV20ToV21_VariablesAndEventsPreserved(t *testing.T) {
	c := &parser.CollectionV20{
		Info:     parser.Info{Name: "T", Schema: parser.SchemaV20},
		Variable: []parser.Variable{{Key: "base_url", Value: "https://api.example.com"}},
		Event:    []parser.Event{{Listen: "prerequest", Script: parser.Script{Type: "text/javascript", Exec: []string{"pm.variables.set('x', 1);"}}}},
	}
	out, err := V20ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Variable, 1)
	assert.Equal(t, "base_url", out.Variable[0].Key)
	require.Len(t, out.Event, 1)
	assert.Equal(t, "prerequest", out.Event[0].Listen)
}

// ── V10ToV21 ────────────────────────────────────────────────────────────────

func TestV10ToV21_Schema(t *testing.T) {
	c := &parser.CollectionV10{Name: "T", Order: []string{}, Folders: []parser.FolderV10{}, Requests: []parser.RequestV10{}}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Equal(t, parser.SchemaV21, out.Info.Schema)
	assert.Equal(t, "T", out.Info.Name)
}

func TestV10ToV21_TopLevelRequests(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1", "req-2"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "Ping", Method: "GET", URL: "https://example.com/ping"},
			{ID: "req-2", Name: "Status", Method: "GET", URL: "https://example.com/status"},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Item, 2)
	assert.Equal(t, "Ping", out.Item[0].Name)
	assert.Equal(t, "Status", out.Item[1].Name)
	assert.False(t, out.Item[0].IsFolder())
}

func TestV10ToV21_FolderItems(t *testing.T) {
	folderID := "folder-1"
	c := &parser.CollectionV10{
		Name:  "T",
		Order: []string{},
		Folders: []parser.FolderV10{
			{ID: folderID, Name: "My Folder", Order: []string{"req-1"}},
		},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "Inner", Method: "POST", URL: "https://example.com/inner", Folder: &folderID},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Item, 1)
	folder := out.Item[0]
	assert.True(t, folder.IsFolder())
	assert.Equal(t, "My Folder", folder.Name)
	require.Len(t, folder.Item, 1)
	assert.Equal(t, "Inner", folder.Item[0].Name)
}

func TestV10ToV21_HeaderParsing(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "GET", URL: "https://example.com", Headers: "Accept: application/json\nX-Api-Version: 2\n"},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	req := out.Item[0].Request
	require.Len(t, req.Header, 2)
	assert.Equal(t, "Accept", req.Header[0].Key)
	assert.Equal(t, "application/json", req.Header[0].Value)
	assert.Equal(t, "X-Api-Version", req.Header[1].Key)
	assert.Equal(t, "2", req.Header[1].Value)
}

func TestV10ToV21_RawBody(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "POST", URL: "https://example.com", DataMode: "raw", Body: `{"foo":"bar"}`},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	body := out.Item[0].Request.Body
	require.NotNil(t, body)
	assert.Equal(t, parser.BodyModeRaw, body.Mode)
	assert.Equal(t, `{"foo":"bar"}`, body.Raw)
}

func TestV10ToV21_URLEncodedBody(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{
				ID: "req-1", Name: "R", Method: "POST", URL: "https://example.com",
				DataMode: "urlencoded",
				Data:     []parser.FormDataV10{{Key: "username", Value: "alice", Enabled: true}, {Key: "password", Value: "x", Enabled: true}},
			},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	body := out.Item[0].Request.Body
	require.NotNil(t, body)
	assert.Equal(t, parser.BodyModeURLEncoded, body.Mode)
	require.Len(t, body.URLEncoded, 2)
	assert.Equal(t, "username", body.URLEncoded[0].Key)
}

func TestV10ToV21_Scripts(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{
				ID: "req-1", Name: "R", Method: "GET", URL: "https://example.com",
				PreRequestScript: "pm.variables.set('x', 1);",
				Tests:            "pm.test(\"ok\", () => pm.response.to.have.status(200));",
			},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	events := out.Item[0].Event
	require.Len(t, events, 2)
	assert.Equal(t, "prerequest", events[0].Listen)
	assert.Equal(t, "test", events[1].Listen)
	assert.Contains(t, parser.ScriptBody(events[1].Script), "pm.test")
}

func TestV10ToV21_MissingRequestID(t *testing.T) {
	// Request IDs referenced in order that don't exist in requests list are skipped.
	c := &parser.CollectionV10{
		Name:     "T",
		Order:    []string{"missing-id"},
		Folders:  []parser.FolderV10{},
		Requests: []parser.RequestV10{},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Empty(t, out.Item)
}

func TestV10ToV21_FormDataBody(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{
				ID: "req-1", Name: "R", Method: "POST", URL: "https://example.com",
				DataMode: "params",
				Data: []parser.FormDataV10{
					{Key: "file", Value: "avatar.png", Enabled: true, Type: "file"},
					{Key: "name", Value: "alice", Enabled: true, Type: "text"},
				},
			},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	body := out.Item[0].Request.Body
	require.NotNil(t, body)
	assert.Equal(t, parser.BodyModeFormData, body.Mode)
	require.Len(t, body.FormData, 2)
	assert.Equal(t, "file", body.FormData[0].Key)
}

func TestV10ToV21_EmptyURLEncodedData(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "POST", URL: "https://example.com", DataMode: "urlencoded", Data: nil},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Nil(t, out.Item[0].Request.Body)
}

func TestV10ToV21_EmptyFormData(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "POST", URL: "https://example.com", DataMode: "params", Data: nil},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Nil(t, out.Item[0].Request.Body)
}

func TestV10ToV21_NoBodyNoDataMode(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "GET", URL: "https://example.com"},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Nil(t, out.Item[0].Request.Body)
}

func TestV10ToV21_EmptyHeaderString(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "GET", URL: "https://example.com", Headers: ""},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	assert.Nil(t, out.Item[0].Request.Header)
}

func TestV10ToV21_HeaderLineWithoutColon(t *testing.T) {
	c := &parser.CollectionV10{
		Name:    "T",
		Order:   []string{"req-1"},
		Folders: []parser.FolderV10{},
		Requests: []parser.RequestV10{
			{ID: "req-1", Name: "R", Method: "GET", URL: "https://example.com", Headers: "Accept: application/json\nBadLine\n"},
		},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	// BadLine has no colon — only the valid header is parsed.
	require.Len(t, out.Item[0].Request.Header, 1)
	assert.Equal(t, "Accept", out.Item[0].Request.Header[0].Key)
}

func TestV20ToV21_ConvertParamsInvalidJSON(t *testing.T) {
	// params that are neither a JSON object nor an array should return an error.
	_, err := convertParams([]byte(`42`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "auth params")
}

func TestV20ToV21_ConvertParamsEmpty(t *testing.T) {
	params, err := convertParams(nil)
	require.NoError(t, err)
	assert.Nil(t, params)
}

func TestV20ToV21_CollectionAuthError(t *testing.T) {
	// Invalid auth params on the collection root should propagate the error.
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Auth: &parser.AuthV20{
			Type:  parser.AuthTypeBasic,
			Basic: []byte(`42`), // not an object or array
		},
	}
	_, err := V20ToV21(c)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "migrate collection auth")
}

func TestV20ToV21_ItemAuthError(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Item: []parser.ItemV20{
			{
				Name: "folder",
				Auth: &parser.AuthV20{Type: parser.AuthTypeBasic, Basic: []byte(`42`)},
			},
		},
	}
	_, err := V20ToV21(c)
	require.Error(t, err)
}

func TestV20ToV21_RequestAuthError(t *testing.T) {
	c := &parser.CollectionV20{
		Info: parser.Info{Name: "T", Schema: parser.SchemaV20},
		Item: []parser.ItemV20{
			{
				Name: "req",
				Request: &parser.RequestV20{
					Method: "GET",
					URL:    parser.URL{Raw: "https://example.com"},
					Auth:   &parser.AuthV20{Type: parser.AuthTypeBasic, Basic: []byte(`42`)},
				},
			},
		},
	}
	_, err := V20ToV21(c)
	require.Error(t, err)
}

func TestV10ToV21_MissingRequestIDInFolder(t *testing.T) {
	// A folder that references a missing request ID should produce an empty folder.
	c := &parser.CollectionV10{
		Name:     "T",
		Order:    []string{},
		Folders:  []parser.FolderV10{{ID: "f1", Name: "F", Order: []string{"missing"}}},
		Requests: []parser.RequestV10{},
	}
	out, err := V10ToV21(c)
	require.NoError(t, err)
	require.Len(t, out.Item, 1)
	assert.Empty(t, out.Item[0].Item)
}
