package main

import (
	"encoding/json"
	"errors"
	"net/http"
)

func (s *server) listCollections(w http.ResponseWriter, _ *http.Request) {
	items, err := s.collections.list()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	if items == nil {
		items = []json.RawMessage{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *server) createCollection(w http.ResponseWriter, r *http.Request) {
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
	if err := s.collections.save(id, raw); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusCreated, raw)
}

func (s *server) getCollection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	data, err := s.collections.get(id)
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

func (s *server) updateCollection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeJSON(w, http.StatusBadRequest, errResp{Error: "invalid body", Code: "bad_request"})
		return
	}
	if err := s.collections.save(id, raw); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, raw)
}

func (s *server) deleteCollection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.collections.delete(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
