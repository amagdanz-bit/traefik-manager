package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ---- helpers ----------------------------------------------------------------

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]any{"error": msg, "ok": false})
}

// ---- health -----------------------------------------------------------------

func (a *App) healthHandler(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]any{"ok": true, "version": Version})
}

// ---- traefik proxy ----------------------------------------------------------

func (a *App) traefikProxy(w http.ResponseWriter, r *http.Request, traefikPath string) {
	target := strings.TrimRight(a.cfg.TraefikAPIURL, "/") + traefikPath
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		jsonError(w, "proxy error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	resp, err := a.httpClient.Do(req)
	if err != nil {
		jsonError(w, "traefik unavailable: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// ---- config files -----------------------------------------------------------

type fileEntry struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (a *App) configsReadHandler(w http.ResponseWriter, r *http.Request) {
	cfgPath := a.cfg.ConfigPath
	info, err := os.Stat(cfgPath)
	if err != nil {
		jsonError(w, "config path not found", http.StatusNotFound)
		return
	}
	var files []fileEntry
	if info.IsDir() {
		entries, err := os.ReadDir(cfgPath)
		if err != nil {
			jsonError(w, "cannot read config dir", http.StatusInternalServerError)
			return
		}
		for _, e := range entries {
			name := e.Name()
			if e.IsDir() || (!strings.HasSuffix(name, ".yml") && !strings.HasSuffix(name, ".yaml")) {
				continue
			}
			data, err := os.ReadFile(filepath.Join(cfgPath, name))
			if err == nil {
				files = append(files, fileEntry{Name: name, Content: string(data)})
			}
		}
	} else {
		data, err := os.ReadFile(cfgPath)
		if err != nil {
			jsonError(w, "cannot read config file", http.StatusInternalServerError)
			return
		}
		files = append(files, fileEntry{Name: filepath.Base(cfgPath), Content: string(data)})
	}
	jsonOK(w, map[string]any{"files": files})
}

func (a *App) configsWriteHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	cfgPath := a.cfg.ConfigPath
	info, err := os.Stat(cfgPath)
	var targetPath string
	if err == nil && info.IsDir() {
		if body.Name == "" || strings.Contains(body.Name, "/") || strings.Contains(body.Name, "..") {
			jsonError(w, "invalid file name", http.StatusBadRequest)
			return
		}
		targetPath = filepath.Join(cfgPath, body.Name)
	} else {
		targetPath = cfgPath
	}
	if err := atomicWrite(targetPath, []byte(body.Content)); err != nil {
		jsonError(w, "write failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if a.cfg.GitBackupEnabled && a.cfg.GitBackupAutoPush && a.cfg.GitBackupRepo != "" {
		go func() {
			if err := a.gitPush("config save"); err != nil {
				log.Printf("git auto-push failed: %v", err)
			}
		}()
	}
	jsonOK(w, map[string]any{"ok": true})
}

func atomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ---- static config ----------------------------------------------------------

func (a *App) staticReadHandler(w http.ResponseWriter, r *http.Request) {
	if a.cfg.StaticConfigPath == "" {
		jsonError(w, "STATIC_CONFIG_PATH not configured", http.StatusNotFound)
		return
	}
	data, err := os.ReadFile(a.cfg.StaticConfigPath)
	if err != nil {
		jsonError(w, "cannot read static config: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"content": string(data), "path": a.cfg.StaticConfigPath})
}

func (a *App) staticWriteHandler(w http.ResponseWriter, r *http.Request) {
	if a.cfg.StaticConfigPath == "" {
		jsonError(w, "STATIC_CONFIG_PATH not configured", http.StatusNotFound)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if err := atomicWrite(a.cfg.StaticConfigPath, []byte(body.Content)); err != nil {
		jsonError(w, "write failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

func (a *App) staticStatusHandler(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]any{
		"configured":       a.cfg.StaticConfigPath != "",
		"path":             a.cfg.StaticConfigPath,
		"restart_method":   a.cfg.RestartMethod,
		"traefik_container": a.cfg.TraefikContainer,
	})
}

func (a *App) staticRestartHandler(w http.ResponseWriter, r *http.Request) {
	switch a.cfg.RestartMethod {
	case "poison-pill":
		if a.cfg.SignalFilePath == "" {
			jsonError(w, "SIGNAL_FILE_PATH not configured", http.StatusBadRequest)
			return
		}
		if err := os.WriteFile(a.cfg.SignalFilePath, []byte("restart"), 0o644); err != nil {
			jsonError(w, "failed to write signal file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]any{"ok": true})

	case "socket", "proxy":
		if err := a.dockerKill(r.Context()); err != nil {
			jsonError(w, "docker restart failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]any{"ok": true})

	default:
		jsonError(w, "RESTART_METHOD not configured or unsupported", http.StatusBadRequest)
	}
}

func (a *App) dockerKill(ctx context.Context) error {
	container := a.cfg.TraefikContainer
	if container == "" {
		container = "traefik"
	}
	apiPath := "/containers/" + container + "/kill?signal=HUP"

	var client *http.Client
	var baseURL string

	dockerHost := a.cfg.DockerHost
	if a.cfg.RestartMethod == "socket" || dockerHost == "" {
		client = &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
					return net.Dial("unix", "/var/run/docker.sock")
				},
			},
		}
		baseURL = "http://localhost"
	} else {
		client = http.DefaultClient
		baseURL = strings.TrimRight(dockerHost, "/")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+apiPath, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("docker API returned %s", resp.Status)
	}
	return nil
}

// ---- crowdsec proxy ---------------------------------------------------------

func (a *App) crowdsecProxy(w http.ResponseWriter, r *http.Request, method, csPath string) {
	if a.cfg.CrowdSecLAPIURL == "" {
		jsonError(w, "CROWDSEC_LAPI_URL not configured", http.StatusNotFound)
		return
	}
	target := strings.TrimRight(a.cfg.CrowdSecLAPIURL, "/") + csPath
	req, err := http.NewRequestWithContext(r.Context(), method, target, nil)
	if err != nil {
		jsonError(w, "proxy error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if a.cfg.CrowdSecAPIKey != "" {
		req.Header.Set("X-Api-Key", a.cfg.CrowdSecAPIKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		jsonError(w, "crowdsec unavailable: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// ---- local backups ----------------------------------------------------------

func (a *App) backupDir() string {
	return filepath.Join(a.cfg.BackupDir, "backups")
}

func (a *App) backupsListHandler(w http.ResponseWriter, r *http.Request) {
	dir := a.backupDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		jsonOK(w, map[string]any{"backups": []any{}})
		return
	}
	type backup struct {
		Name string `json:"name"`
		Size int64  `json:"size"`
		Date string `json:"date"`
	}
	var list []backup
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".zip") {
			info, _ := e.Info()
			size := int64(0)
			date := ""
			if info != nil {
				size = info.Size()
				date = info.ModTime().UTC().Format(time.RFC3339)
			}
			list = append(list, backup{Name: e.Name(), Size: size, Date: date})
		}
	}
	jsonOK(w, map[string]any{"backups": list})
}

func (a *App) backupCreateHandler(w http.ResponseWriter, r *http.Request) {
	name, err := a.createBackup()
	if err != nil {
		jsonError(w, "backup failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true, "name": name})
}

func (a *App) createBackup() (string, error) {
	dir := a.backupDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	ts := time.Now().UTC().Format("20060102-150405")
	name := "backup-" + ts + ".zip"
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	addFile := func(src string) {
		data, err := os.ReadFile(src)
		if err != nil {
			return
		}
		w, err := zw.Create(filepath.Base(src))
		if err != nil {
			return
		}
		w.Write(data)
	}
	cfgPath := a.cfg.ConfigPath
	info, err := os.Stat(cfgPath)
	if err == nil {
		if info.IsDir() {
			entries, _ := os.ReadDir(cfgPath)
			for _, e := range entries {
				if !e.IsDir() {
					addFile(filepath.Join(cfgPath, e.Name()))
				}
			}
		} else {
			addFile(cfgPath)
		}
	}
	if a.cfg.StaticConfigPath != "" {
		addFile(a.cfg.StaticConfigPath)
	}
	return name, nil
}

func (a *App) restoreHandler(w http.ResponseWriter, r *http.Request) {
	filename := strings.TrimPrefix(r.URL.Path, "/api/restore/")
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") || !strings.HasSuffix(filename, ".zip") {
		jsonError(w, "invalid filename", http.StatusBadRequest)
		return
	}
	path := filepath.Join(a.backupDir(), filename)
	zr, err := zip.OpenReader(path)
	if err != nil {
		jsonError(w, "cannot open backup: "+err.Error(), http.StatusNotFound)
		return
	}
	defer zr.Close()
	cfgPath := a.cfg.ConfigPath
	info, _ := os.Stat(cfgPath)
	isDir := err == nil && info.IsDir()
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			continue
		}
		data, _ := io.ReadAll(rc)
		rc.Close()
		var dest string
		if isDir {
			dest = filepath.Join(cfgPath, f.Name)
		} else {
			dest = cfgPath
		}
		atomicWrite(dest, data)
	}
	jsonOK(w, map[string]any{"ok": true})
}

func (a *App) backupDeleteHandler(w http.ResponseWriter, r *http.Request) {
	filename := strings.TrimPrefix(r.URL.Path, "/api/backup/delete/")
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") || !strings.HasSuffix(filename, ".zip") {
		jsonError(w, "invalid filename", http.StatusBadRequest)
		return
	}
	path := filepath.Join(a.backupDir(), filename)
	if err := os.Remove(path); err != nil {
		jsonError(w, "delete failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

// ---- git backup -------------------------------------------------------------

func (a *App) gitRepoDir() string {
	return filepath.Join(a.cfg.BackupDir, "git-repo")
}

func (a *App) gitRun(args []string, cwd string) (string, string, int) {
	cmd := exec.Command("git", args...)
	if cwd == "" {
		cwd = a.gitRepoDir()
	}
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	rc := 0
	if err != nil {
		if ex, ok := err.(*exec.ExitError); ok {
			rc = ex.ExitCode()
		} else {
			rc = 1
		}
	}
	return strings.TrimSpace(stdout.String()), strings.TrimSpace(stderr.String()), rc
}

func (a *App) gitAuthURL() string {
	repo := a.cfg.GitBackupRepo
	token := a.cfg.GitBackupToken
	if token == "" {
		return repo
	}
	u, err := url.Parse(repo)
	if err != nil {
		return repo
	}
	if a.cfg.GitBackupUsername != "" {
		u.User = url.UserPassword(a.cfg.GitBackupUsername, token)
	} else {
		u.User = url.User(token)
	}
	return u.String()
}

func (a *App) gitEnsureRepo() (string, error) {
	repoDir := a.gitRepoDir()
	gitDir := filepath.Join(repoDir, ".git")
	branch := a.cfg.GitBackupBranch
	authURL := a.gitAuthURL()

	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		if entries, err := os.ReadDir(repoDir); err == nil && len(entries) > 0 {
			os.RemoveAll(repoDir)
			log.Printf("git repo dir was non-empty without .git - cleared for fresh clone")
		}
		if err := os.MkdirAll(repoDir, 0o755); err != nil {
			return "", err
		}
		_, _, rc := a.gitRun([]string{"clone", "--branch", branch, authURL, "."}, repoDir)
		if rc != 0 {
			a.gitRun([]string{"init"}, repoDir)
			a.gitRun([]string{"remote", "add", "origin", authURL}, repoDir)
			a.gitRun([]string{"config", "user.email", "traefik-manager-agent@localhost"}, repoDir)
			a.gitRun([]string{"config", "user.name", "Traefik Manager Agent"}, repoDir)
			a.gitRun([]string{"pull", "origin", branch}, repoDir)
		}
	} else {
		a.gitRun([]string{"remote", "set-url", "origin", authURL}, repoDir)
		a.gitRun([]string{"config", "user.email", "traefik-manager-agent@localhost"}, repoDir)
		a.gitRun([]string{"config", "user.name", "Traefik Manager Agent"}, repoDir)
	}
	return repoDir, nil
}

func (a *App) gitPush(action string) error {
	if a.cfg.GitBackupRepo == "" {
		return fmt.Errorf("no repository configured")
	}
	repoDir, err := a.gitEnsureRepo()
	if err != nil {
		return fmt.Errorf("repo init failed: %w", err)
	}
	dynDir := filepath.Join(repoDir, "dynamic")
	staticDir := filepath.Join(repoDir, "static")
	os.MkdirAll(dynDir, 0o755)
	os.MkdirAll(staticDir, 0o755)

	copyToDir := func(src, destDir string) {
		info, err := os.Stat(src)
		if err != nil {
			return
		}
		if info.IsDir() {
			entries, _ := os.ReadDir(src)
			for _, e := range entries {
				if !e.IsDir() {
					data, err := os.ReadFile(filepath.Join(src, e.Name()))
					if err == nil {
						os.WriteFile(filepath.Join(destDir, e.Name()), data, 0o644)
					}
				}
			}
		} else {
			data, err := os.ReadFile(src)
			if err == nil {
				os.WriteFile(filepath.Join(destDir, filepath.Base(src)), data, 0o644)
			}
		}
	}

	copyToDir(a.cfg.ConfigPath, dynDir)
	if a.cfg.StaticConfigPath != "" {
		copyToDir(a.cfg.StaticConfigPath, staticDir)
	}

	ts := time.Now().Format("2006-01-02 15:04:05")
	msg := strings.NewReplacer("{action}", action, "{timestamp}", ts).Replace(a.cfg.GitBackupCommitMsg)

	a.gitRun([]string{"add", "-A"}, repoDir)
	_, _, rc := a.gitRun([]string{"diff", "--cached", "--quiet"}, repoDir)
	if rc == 0 {
		return nil
	}
	_, errOut, rc := a.gitRun([]string{"commit", "-m", msg}, repoDir)
	if rc != 0 {
		return fmt.Errorf("commit failed: %s", errOut)
	}
	_, errOut, rc = a.gitRun([]string{"push", "-u", "origin", a.cfg.GitBackupBranch}, repoDir)
	if rc != 0 {
		token := a.cfg.GitBackupToken
		if token != "" {
			errOut = strings.ReplaceAll(errOut, token, "***")
		}
		return fmt.Errorf("push failed: %s", errOut)
	}
	log.Printf("git backup pushed: %s", msg)
	return nil
}

var shaRe = regexp.MustCompile(`^[0-9a-f]{7,40}$`)

func (a *App) gitStatusHandler(w http.ResponseWriter, r *http.Request) {
	result := map[string]any{
		"enabled":    a.cfg.GitBackupEnabled,
		"configured": a.cfg.GitBackupRepo != "",
		"last_sha":   nil,
		"last_push":  nil,
	}
	repoDir := a.gitRepoDir()
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err == nil {
		out, _, rc := a.gitRun([]string{"log", "-1", "--format=%H|%ci|%s"}, repoDir)
		if rc == 0 && strings.Contains(out, "|") {
			parts := strings.SplitN(out, "|", 3)
			if len(parts) >= 2 {
				result["last_sha"] = parts[0][:8]
				result["last_push"] = strings.TrimSpace(parts[1])
			}
		}
	}
	jsonOK(w, result)
}

func (a *App) gitPushHandler(w http.ResponseWriter, r *http.Request) {
	if err := a.gitPush("manual"); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

func (a *App) gitTestHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RepoURL  string `json:"repo_url"`
		Username string `json:"username"`
		Token    string `json:"token"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	repo := body.RepoURL
	if repo == "" {
		repo = a.cfg.GitBackupRepo
	}
	username := body.Username
	if username == "" {
		username = a.cfg.GitBackupUsername
	}
	token := body.Token
	if token == "" {
		token = a.cfg.GitBackupToken
	}
	if repo == "" {
		jsonError(w, "no repository URL configured", http.StatusBadRequest)
		return
	}
	u, err := url.Parse(repo)
	if err != nil {
		jsonError(w, "invalid repo URL", http.StatusBadRequest)
		return
	}
	if token != "" {
		if username != "" {
			u.User = url.UserPassword(username, token)
		} else {
			u.User = url.User(token)
		}
	}
	tmpDir, err := os.MkdirTemp("", "tma-git-test-*")
	if err != nil {
		jsonError(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmpDir)
	_, errOut, rc := a.gitRun([]string{"ls-remote", "--quiet", u.String()}, tmpDir)
	if rc != 0 {
		if token != "" {
			errOut = strings.ReplaceAll(errOut, token, "***")
		}
		jsonError(w, errOut, http.StatusBadRequest)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

func (a *App) gitCommitsHandler(w http.ResponseWriter, r *http.Request) {
	repoDir := a.gitRepoDir()
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err != nil {
		jsonOK(w, []any{})
		return
	}
	out, _, rc := a.gitRun([]string{"log", "--format=%H|%ci|%s", "-50"}, repoDir)
	if rc != 0 {
		jsonOK(w, []any{})
		return
	}
	type commit struct {
		SHA      string `json:"sha"`
		SHAShort string `json:"sha_short"`
		Time     string `json:"timestamp"`
		Message  string `json:"message"`
	}
	var commits []commit
	for _, line := range strings.Split(out, "\n") {
		parts := strings.SplitN(line, "|", 3)
		if len(parts) == 3 {
			commits = append(commits, commit{
				SHA:      parts[0],
				SHAShort: parts[0][:8],
				Time:     strings.TrimSpace(parts[1]),
				Message:  parts[2],
			})
		}
	}
	jsonOK(w, commits)
}

func (a *App) gitDiffHandler(w http.ResponseWriter, r *http.Request, sha string) {
	if !shaRe.MatchString(sha) {
		jsonError(w, "invalid sha", http.StatusBadRequest)
		return
	}
	repoDir := a.gitRepoDir()
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err != nil {
		jsonOK(w, map[string]any{"stat": "", "files": []any{}})
		return
	}
	stat, _, _ := a.gitRun([]string{"show", "--stat", "--format=", sha}, repoDir)
	changed, _, rc := a.gitRun([]string{"diff-tree", "--no-commit-id", "-r", "--name-status", sha}, repoDir)
	if rc != 0 {
		jsonError(w, "diff failed", http.StatusInternalServerError)
		return
	}
	type fileDiff struct {
		Filename string `json:"filename"`
		Status   string `json:"status"`
		Old      string `json:"old"`
		New      string `json:"new"`
	}
	var files []fileDiff
	for _, line := range strings.Split(changed, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		status, filename := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		newContent, _, newRC := a.gitRun([]string{"show", sha + ":" + filename}, repoDir)
		oldContent, _, oldRC := a.gitRun([]string{"show", sha + "^:" + filename}, repoDir)
		files = append(files, fileDiff{
			Filename: filename,
			Status:   status,
			Old:      map[bool]string{true: oldContent, false: ""}[oldRC == 0],
			New:      map[bool]string{true: newContent, false: ""}[newRC == 0],
		})
	}
	jsonOK(w, map[string]any{"stat": stat, "files": files})
}

func (a *App) gitRestoreHandler(w http.ResponseWriter, r *http.Request, sha string) {
	if !shaRe.MatchString(sha) {
		jsonError(w, "invalid sha", http.StatusBadRequest)
		return
	}
	repoDir := a.gitRepoDir()
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err != nil {
		jsonError(w, "git repo not initialized", http.StatusBadRequest)
		return
	}
	if _, err := a.createBackup(); err != nil {
		log.Printf("pre-restore backup failed: %v", err)
	}
	cfgPath := a.cfg.ConfigPath
	info, _ := os.Stat(cfgPath)
	isDir := info != nil && info.IsDir()
	changed, _, rc := a.gitRun([]string{"diff-tree", "--no-commit-id", "-r", "--name-only", sha}, repoDir)
	if rc != 0 {
		jsonError(w, "failed to list commit files", http.StatusInternalServerError)
		return
	}
	for _, filename := range strings.Split(changed, "\n") {
		filename = strings.TrimSpace(filename)
		if filename == "" {
			continue
		}
		content, _, fileRC := a.gitRun([]string{"show", sha + ":" + filename}, repoDir)
		if fileRC != 0 {
			continue
		}
		base := filepath.Base(filename)
		var dest string
		if isDir {
			dest = filepath.Join(cfgPath, base)
		} else {
			dest = cfgPath
		}
		atomicWrite(dest, []byte(content))
	}
	if a.cfg.StaticConfigPath != "" {
		base := filepath.Base(a.cfg.StaticConfigPath)
		content, _, rc := a.gitRun([]string{"show", sha + ":static/" + base}, repoDir)
		if rc == 0 {
			atomicWrite(a.cfg.StaticConfigPath, []byte(content))
		}
	}
	jsonOK(w, map[string]any{"ok": true})
}

func (a *App) gitResetHandler(w http.ResponseWriter, r *http.Request) {
	repoDir := a.gitRepoDir()
	if err := os.RemoveAll(repoDir); err != nil {
		jsonError(w, "reset failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("git repo directory reset by user")
	jsonOK(w, map[string]any{"ok": true})
}
