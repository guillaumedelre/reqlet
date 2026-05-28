package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/guillaumedelre/reqlet/engine/storage"
)

type historySummary struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	Method     string    `json:"method"`
	URL        string    `json:"url"`
	Status     int       `json:"status"`
	DurationMs int64     `json:"durationMs"`
}

func (s *server) listHistory(w http.ResponseWriter, r *http.Request) {
	if s.storage == nil {
		writeJSON(w, http.StatusOK, []historySummary{})
		return
	}

	limit, offset := 50, 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	entries, err := s.storage.History.List(r.Context(), limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}

	summaries := make([]historySummary, 0, len(entries))
	for _, e := range entries {
		summaries = append(summaries, entryToSummary(e))
	}
	writeJSON(w, http.StatusOK, summaries)
}

func (s *server) deleteHistoryEntry(w http.ResponseWriter, r *http.Request) {
	if s.storage == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.storage.History.Delete(r.Context(), r.PathValue("id")); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) clearHistory(w http.ResponseWriter, r *http.Request) {
	if s.storage == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := s.storage.History.Clear(r.Context()); err != nil {
		writeJSON(w, http.StatusInternalServerError, errResp{Error: err.Error(), Code: "internal_error"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func entryToSummary(e storage.HistoryEntry) historySummary {
	var req struct {
		Method string `json:"method"`
		URL    string `json:"url"`
	}
	var resp struct {
		Status int `json:"status"`
	}
	_ = json.Unmarshal(e.Request, &req)
	_ = json.Unmarshal(e.Response, &resp)
	return historySummary{
		ID:         e.ID,
		Timestamp:  e.Timestamp,
		Method:     req.Method,
		URL:        req.URL,
		Status:     resp.Status,
		DurationMs: e.DurationMs,
	}
}
