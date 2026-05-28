package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

const (
	settingKeyProxyURL          = "proxy.url"
	settingKeyProxyUsername     = "proxy.username"
	settingKeyProxyPassword     = "proxy.password"
	settingKeyNoProxy           = "proxy.noProxy"
	settingKeySSLVerification   = "ssl.verification"
	settingKeyUseSystemProxy    = "proxy.useSystem"
	settingKeyRespectEnvProxy   = "proxy.respectEnv"
	settingKeyMaxResponseSizeMB = "response.maxSizeMB"
	settingKeyScriptTimeoutMs   = "script.timeoutMs"
)

type settingsData struct {
	ProxyURL          string `json:"proxyUrl"`
	ProxyUsername     string `json:"proxyUsername"`
	ProxyPassword     string `json:"proxyPassword"`
	NoProxy           string `json:"noProxy"`
	SSLVerification   bool   `json:"sslVerification"`
	UseSystemProxy    bool   `json:"useSystemProxy"`
	RespectEnvProxy   bool   `json:"respectEnvProxy"`
	MaxResponseSizeMB int    `json:"maxResponseSizeMB"`
	ScriptTimeoutMs   int    `json:"scriptTimeoutMs"`
}

type settingsInput struct {
	ProxyURL          *string `json:"proxyUrl"`
	ProxyUsername     *string `json:"proxyUsername"`
	ProxyPassword     *string `json:"proxyPassword"`
	NoProxy           *string `json:"noProxy"`
	SSLVerification   *bool   `json:"sslVerification"`
	UseSystemProxy    *bool   `json:"useSystemProxy"`
	RespectEnvProxy   *bool   `json:"respectEnvProxy"`
	MaxResponseSizeMB *int    `json:"maxResponseSizeMB"`
	ScriptTimeoutMs   *int    `json:"scriptTimeoutMs"`
}

func (s *server) getSettings(w http.ResponseWriter, r *http.Request) {
	if s.storage == nil {
		writeJSON(w, http.StatusOK, defaultSettings())
		return
	}

	all, err := s.storage.Settings.List(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, buildSettings(all))
}

func (s *server) putSettings(w http.ResponseWriter, r *http.Request) {
	if s.storage == nil {
		writeJSON(w, http.StatusOK, defaultSettings())
		return
	}

	var input settingsInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid JSON", Code: "bad_request"})
		return
	}

	updates := map[string]string{}
	setBool := func(key string, v *bool) {
		if v != nil {
			updates[key] = fmt.Sprintf("%t", *v)
		}
	}
	setInt := func(key string, v *int) {
		if v != nil {
			updates[key] = strconv.Itoa(*v)
		}
	}

	if input.ProxyURL != nil {
		updates[settingKeyProxyURL] = *input.ProxyURL
	}
	if input.ProxyUsername != nil {
		updates[settingKeyProxyUsername] = *input.ProxyUsername
	}
	if input.ProxyPassword != nil {
		updates[settingKeyProxyPassword] = *input.ProxyPassword
	}
	if input.NoProxy != nil {
		updates[settingKeyNoProxy] = *input.NoProxy
	}
	setBool(settingKeySSLVerification, input.SSLVerification)
	setBool(settingKeyUseSystemProxy, input.UseSystemProxy)
	setBool(settingKeyRespectEnvProxy, input.RespectEnvProxy)
	setInt(settingKeyMaxResponseSizeMB, input.MaxResponseSizeMB)
	setInt(settingKeyScriptTimeoutMs, input.ScriptTimeoutMs)

	for k, v := range updates {
		if err := s.storage.Settings.Set(r.Context(), k, v); err != nil {
			writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
			return
		}
	}

	all, err := s.storage.Settings.List(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, buildSettings(all))
}

// loadSettings reads settings from storage or returns defaults when storage is unavailable.
func (s *server) loadSettings(r *http.Request) settingsData {
	if s.storage == nil {
		return defaultSettings()
	}
	all, err := s.storage.Settings.List(r.Context())
	if err != nil {
		return defaultSettings()
	}
	return buildSettings(all)
}

func defaultSettings() settingsData {
	return settingsData{
		SSLVerification:   true,
		MaxResponseSizeMB: 50,
		ScriptTimeoutMs:   5000,
	}
}

func buildSettings(m map[string]string) settingsData {
	d := defaultSettings()
	if v, ok := m[settingKeyProxyURL]; ok {
		d.ProxyURL = v
	}
	if v, ok := m[settingKeyProxyUsername]; ok {
		d.ProxyUsername = v
	}
	if v, ok := m[settingKeyProxyPassword]; ok {
		d.ProxyPassword = v
	}
	if v, ok := m[settingKeyNoProxy]; ok {
		d.NoProxy = v
	}
	if v, ok := m[settingKeySSLVerification]; ok {
		d.SSLVerification = v == "true"
	}
	if v, ok := m[settingKeyUseSystemProxy]; ok {
		d.UseSystemProxy = v == "true"
	}
	if v, ok := m[settingKeyRespectEnvProxy]; ok {
		d.RespectEnvProxy = v == "true"
	}
	if v, ok := m[settingKeyMaxResponseSizeMB]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			d.MaxResponseSizeMB = n
		}
	}
	if v, ok := m[settingKeyScriptTimeoutMs]; ok {
		if n, err := strconv.Atoi(v); err == nil {
			d.ScriptTimeoutMs = n
		}
	}
	return d
}
