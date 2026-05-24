// Package main is the entry point for the Reqlet desktop application.
// It uses Wails v2 (github.com/wailsapp/wails/v2) to expose Go methods
// to the React frontend via window.go.* bindings.
// The Wails dependency and full IPC wiring are introduced in Phase 2.
package main

// App holds application-level state and exposes methods to the frontend
// via Wails bindings.
type App struct{}

// NewApp creates the application instance.
func NewApp() *App {
	return &App{}
}
