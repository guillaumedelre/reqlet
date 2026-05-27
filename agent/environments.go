package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/guillaumedelre/reqlet/engine/loader"
)

func (s *server) listEnvironments(w http.ResponseWriter, _ *http.Request) {
	items, err := s.environments.list()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	if items == nil {
		items = []json.RawMessage{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) createEnvironment(w http.ResponseWriter, r *http.Request) {
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid body", Code: "bad_request"})
		return
	}
	id, err := extractStringField(raw, "id")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "missing id field", Code: "bad_request"})
		return
	}
	if err := s.environments.save(id, raw); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusCreated, raw)
}

func (s *server) getEnvironment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	data, err := s.environments.get(id)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeJSON(w, http.StatusNotFound, errResp{Error: "not found", Code: "not_found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (s *server) updateEnvironment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid body", Code: "bad_request"})
		return
	}
	if err := s.environments.save(id, raw); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, raw)
}

func (s *server) deleteEnvironment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.environments.delete(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) importEnvironment(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "read body: " + err.Error(), Code: "bad_request"})
		return
	}
	env, err := loader.LoadEnvironment(bytes.NewReader(body))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid environment: " + err.Error(), Code: "bad_request"})
		return
	}
	data, err := EnvironmentToFrontend(env)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	id, err := extractStringField(data, "id")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: "missing id after conversion", Code: "internal_error"})
		return
	}
	if err := s.environments.save(id, data); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusCreated, data)
}

func (s *server) exportEnvironment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	data, err := s.environments.get(id)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeJSON(w, http.StatusNotFound, errResp{Error: "not found", Code: "not_found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	env, err := EnvironmentToParser(data)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	out, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	var probe struct {
		Name string `json:"name"`
	}
	_ = json.Unmarshal(data, &probe)
	filename := fmt.Sprintf("%s.postman_environment.json", sanitizeFilename(probe.Name))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out)
}
