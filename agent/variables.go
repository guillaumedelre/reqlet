package main

import (
	"encoding/json"
	"net/http"
)

type variablesResponse struct {
	Globals     []feVariable `json:"globals"`
	Environment []feVariable `json:"environment"`
	Collection  []feVariable `json:"collection"`
}

func (s *server) getVariables(w http.ResponseWriter, r *http.Request) {
	resp := variablesResponse{
		Globals:     []feVariable{},
		Environment: []feVariable{},
		Collection:  []feVariable{},
	}

	if envID := r.URL.Query().Get("environmentId"); envID != "" {
		if data, err := s.environments.get(envID); err == nil {
			var fe struct {
				Variables []feVariable `json:"variables"`
			}
			if json.Unmarshal(data, &fe) == nil && fe.Variables != nil {
				resp.Environment = fe.Variables
			}
		}
	}

	if colID := r.URL.Query().Get("collectionId"); colID != "" {
		if data, err := s.collections.get(colID); err == nil {
			var fe struct {
				Variables []feVariable `json:"variables"`
			}
			if json.Unmarshal(data, &fe) == nil && fe.Variables != nil {
				resp.Collection = fe.Variables
			}
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
