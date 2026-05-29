package sandbox

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
)

// nodeRunner communicates with a Node.js subprocess over stdio.
type nodeRunner struct {
	cmd      *exec.Cmd
	stdin    io.WriteCloser
	mu       sync.Mutex
	inflight map[string]chan response
	nextID   atomic.Uint64
	done     chan struct{}
}

// ipcRequest is the JSON message sent to the node process.
type ipcRequest struct {
	ID     string        `json:"id"`
	Method string        `json:"method"`
	Params executeParams `json:"params"`
}

type executeParams struct {
	Script  string         `json:"script"`
	Event   string         `json:"event"`
	Context *ScriptContext `json:"context"`
}

// ipcResponse is the JSON message received from the node process.
type ipcResponse struct {
	ID     string        `json:"id"`
	Result *ScriptResult `json:"result"`
	Error  string        `json:"error"`
}

type response struct {
	result *ScriptResult
	err    error
}

// NewRunner starts the Node.js runner process at the given script path.
// The working directory is set to the script's directory so that Node.js
// resolves node_modules correctly.
func NewRunner(scriptPath string) (Runner, error) {
	// Resolve to absolute so Node can find the file regardless of cmd.Dir.
	absPath, err := filepath.Abs(scriptPath)
	if err != nil {
		return nil, fmt.Errorf("sandbox: resolve script path: %w", err)
	}
	cmd := exec.Command("node", absPath) //nolint:gosec // scriptPath is controlled by the caller
	// node_modules lives in the parent of src/, so set cwd there.
	cmd.Dir = filepath.Dir(filepath.Dir(absPath))

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("sandbox: stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("sandbox: stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("sandbox: start node: %w", err)
	}

	r := &nodeRunner{
		cmd:      cmd,
		stdin:    stdin,
		inflight: make(map[string]chan response),
		done:     make(chan struct{}),
	}

	go r.readLoop(stdout)
	return r, nil
}

// Execute sends a script to the node process and waits for the result.
func (r *nodeRunner) Execute(ctx context.Context, script, event string, sctx *ScriptContext) (*ScriptResult, error) {
	id := fmt.Sprintf("%d", r.nextID.Add(1))
	ch := make(chan response, 1)

	r.mu.Lock()
	r.inflight[id] = ch
	r.mu.Unlock()

	req := ipcRequest{
		ID:     id,
		Method: "execute",
		Params: executeParams{Script: script, Event: event, Context: sctx},
	}
	line, err := json.Marshal(req)
	if err != nil {
		r.removeInflight(id)
		return nil, fmt.Errorf("sandbox: marshal request: %w", err)
	}

	r.mu.Lock()
	_, err = fmt.Fprintf(r.stdin, "%s\n", line)
	r.mu.Unlock()
	if err != nil {
		r.removeInflight(id)
		return nil, fmt.Errorf("sandbox: write to node: %w", err)
	}

	select {
	case <-ctx.Done():
		r.removeInflight(id)
		return nil, ctx.Err()
	case <-r.done:
		r.removeInflight(id)
		return nil, fmt.Errorf("sandbox: node process exited")
	case resp := <-ch:
		return resp.result, resp.err
	}
}

// Close shuts down the node process.
func (r *nodeRunner) Close() error {
	_ = r.stdin.Close()
	return r.cmd.Wait()
}

func (r *nodeRunner) readLoop(stdout io.Reader) {
	defer close(r.done)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 4*1024*1024), 4*1024*1024) // 4 MB — handles large response bodies
	for scanner.Scan() {
		var resp ipcResponse
		if err := json.Unmarshal(scanner.Bytes(), &resp); err != nil {
			continue
		}
		r.mu.Lock()
		ch, ok := r.inflight[resp.ID]
		if ok {
			delete(r.inflight, resp.ID)
		}
		r.mu.Unlock()

		if !ok {
			continue
		}
		if resp.Error != "" {
			ch <- response{err: fmt.Errorf("sandbox: %s", resp.Error)}
		} else {
			ch <- response{result: resp.Result}
		}
	}
}

func (r *nodeRunner) removeInflight(id string) {
	r.mu.Lock()
	delete(r.inflight, id)
	r.mu.Unlock()
}
