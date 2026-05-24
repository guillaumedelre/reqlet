package main

import "log"

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	app := NewApp()
	_ = app
	return nil
}
