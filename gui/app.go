// Package main is the entry point for the Reqlet desktop application.
// Wails v2 exposes Go methods to the React frontend via window.go.* bindings.
package main

import "context"

// App holds application state and exposes methods to the frontend via Wails bindings.
type App struct {
	ctx context.Context
}

// NewApp creates the application instance.
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(_ context.Context) {}
