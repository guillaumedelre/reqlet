// Package reporter provides pluggable output formatters for collection run results.
package reporter

import "github.com/guillaumedelre/reqlet/engine/runner"

// Reporter streams and summarises the result of a collection run.
type Reporter interface {
	OnStart(collectionName string)
	OnRequest(iterIdx int, result runner.RequestResult)
	OnDone(result *runner.RunResult)
}

// Multi fans out to several reporters.
type Multi struct {
	reporters []Reporter
}

// NewMulti wraps zero or more reporters into a single Reporter.
func NewMulti(reporters ...Reporter) *Multi {
	return &Multi{reporters: reporters}
}

func (m *Multi) OnStart(name string) {
	for _, r := range m.reporters {
		r.OnStart(name)
	}
}

func (m *Multi) OnRequest(iterIdx int, result runner.RequestResult) {
	for _, r := range m.reporters {
		r.OnRequest(iterIdx, result)
	}
}

func (m *Multi) OnDone(result *runner.RunResult) {
	for _, r := range m.reporters {
		r.OnDone(result)
	}
}
