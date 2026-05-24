// Package cmd contains the CLI commands for reqlet.
package cmd

import "github.com/spf13/cobra"

var rootCmd = &cobra.Command{
	Use:   "reqlet",
	Short: "A Postman-compatible API client and test runner",
}

// Execute runs the root command.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(runCmd)
}
