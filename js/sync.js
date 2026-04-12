/**
 * GitHub Cloud Sync Module for SlidePy
 * Handles REST API interaction with GitHub to store presentation library.
 */
const GithubSync = {
  config: {
    token: localStorage.getItem('slidepy_gh_token') || '',
    repo: localStorage.getItem('slidepy_gh_repo') || '', // format: 'username/repo'
    path: 'presentations.json'
  },

  isConnected() {
    return !!(this.config.token && this.config.repo);
  },

  saveConfig(token, repo) {
    // Sanitize repo: remove "https://github.com/" if user pasted full URL
    let cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    this.config.token = token.trim();
    this.config.repo = cleanRepo;
    localStorage.setItem('slidepy_gh_token', this.config.token);
    localStorage.setItem('slidepy_gh_repo', this.config.repo);
  },

  clearConfig() {
    this.config.token = '';
    this.config.repo = '';
    localStorage.removeItem('slidepy_gh_token');
    localStorage.removeItem('slidepy_gh_repo');
  },

  async apiCall(endpoint, method = 'GET', body = null) {
    const baseUrl = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.path}`;
    // If endpoint is provided, use it instead (for user/repo discovery)
    const url = endpoint ? `https://api.github.com${endpoint}` : baseUrl;
    
    const headers = {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error (${response.status})`);
    }
    return await response.json();
  },

  async fetchAccessibleRepos() {
    return await this.apiCall('/user/repos?affiliation=owner&sort=updated');
  },

  async upload() {
    if (!this.isConnected()) return;
    
    try {
      // 1. Persist local state (only if a presentation is currently open)
      if (typeof activePresentationId !== 'undefined' && activePresentationId && typeof saveCurrentPresentation === 'function') {
        saveCurrentPresentation();
      }
      
      // 2. Prepare data
      const presentations = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
      const jsonStr = JSON.stringify(presentations, null, 2);
      const content = btoa(unescape(encodeURIComponent(jsonStr)));
      
      // 3. Get existing file for SHA
      let sha = null;
      try {
        const existing = await this.apiCall();
        if (existing) sha = existing.sha;
      } catch (e) {
        // file might not exist yet, 404 is handled in apiCall
      }

      // 4. Push update
      const body = {
        message: 'Sync presentations from SlidePy',
        content: content
      };
      if (sha) body.sha = sha;

      await this.apiCall(null, 'PUT', body);
      toast('Cloud backup complete!');
      if (typeof closeModal === 'function') closeModal('syncModal');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  },

  async download() {
    if (!this.isConnected()) return;

    try {
      // 1. Fetch remote data
      const remoteFile = await this.apiCall();
      if (!remoteFile) {
        toast('No cloud backup found.');
        return;
      }

      // Strip whitespaces for atob compatibility
      const cleanedContent = remoteFile.content.replace(/\s/g, '');
      const remoteData = JSON.parse(decodeURIComponent(escape(atob(cleanedContent))));
      
      // 2. Merge with local data (Merge by ID, newest timestamp wins)
      const localData = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
      const merged = this.mergeLibraries(localData, remoteData);
      
      // 3. Save and refresh
      localStorage.setItem('slidepy_presentations', JSON.stringify(merged));
      if (typeof renderHomeScreen === 'function') renderHomeScreen();
      toast('Sync download complete!');
      if (typeof closeModal === 'function') closeModal('syncModal');
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  },

  mergeLibraries(local, remote) {
    const map = new Map();
    // Use IDs to track unique presentations
    [...local, ...remote].forEach(p => {
      const existing = map.get(p.id);
      if (!existing || p.savedAt > existing.savedAt) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }
};
