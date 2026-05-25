package main

import (
	"log"
	"os"
)

func main() {
	addr := ":8082"
	if v := os.Getenv("REQLET_HUB_ADDR"); v != "" {
		addr = v
	}

	s := NewServer(addr)
	log.Printf("reqlet-hub listening on %s", addr)
	if err := s.Start(); err != nil {
		log.Fatal(err)
	}
}
