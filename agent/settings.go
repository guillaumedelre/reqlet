package main

import (
	"encoding/json"
	"net/http"
)

const (
	settingKeyProxyURL        = "proxy.url"
	settingKeyProxyUsername   = "proxy.username"
	settingKeyProxyPassword   = "proxy.password"
	settingKeyNoProxy         = "proxy.noProxy"
	settingKeySSLVerification = "ssl.verification"
)

type settingsData struct {
	ProxyURL        string `json:"proxyUrl"`
	ProxyUsername   string `json:"proxyUsername"`
	ProxyPassword   string `json:"proxyPassword"`
	NoProxy         string `json:"noProxy"`
	SSLVerification bool   `json:"sslVerification"`
}

type settingsInput struct {
	ProxyURL        *string `json:"proxyUrl"`
	ProxyUsername   *string `json:"proxyUsername"`
	ProxyPassword   *string `json:"proxyPassword"`
	NoProxy         *string `json:"noProxy"`
	SSLVerification *bool   `json:"sslVerification"`
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
	if input.SSLVerification != nil {
		if *input.SSLVerification {
			updates[settingKeySSLVerification] = "true"
		} else {
			updates[settingKeySSLVerification] = "false"
		}
	}

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

func defaultSettings() settingsData {
	return settingsData{SSLVerification: true}
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
	return d
}
