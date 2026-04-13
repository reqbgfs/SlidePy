/**
 * GitHub Cloud Sync Module for SlidePy
 * Handles REST API interaction with GitHub to store presentation library.
 */
const GithubSync = {
  config: {
    token: localStorage.getItem('slidepy_gh_token') || '',
    repo: localStorage.getItem('slidepy_gh_repo') || '', 
    basePath: 'SlidePyLibrary'
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
    const isFullUrl = endpoint && endpoint.startsWith('https://');
    let url = isFullUrl ? endpoint : `https://api.github.com/repos/${this.config.repo}/contents/${endpoint || this.config.basePath}`;
    
    // Discovery fallback for legacy root path if SlidePyLibrary doesn't exist yet
    if (!endpoint && method === 'GET' && !isFullUrl) {
      url = `https://api.github.com/repos/${this.config.repo}/contents/${this.config.basePath}`;
    }

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
    const presId = activePresentationId;
    if (!presId) { toast('Please open a presentation to sync.'); return; }

    try {
      // 1. Ensure latest local save (strips DataURLs for metadata, saves payload to IDB)
      await saveCurrentPresentation();
      
      const list = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
      const meta = list.find(x => x.id === presId);
      if (!meta) throw new Error("Presentation metadata not found.");

      // Fetch full content from IndexedDB for the actual sync
      const payload = await AssetDB.getPresentation(presId);
      if (!payload) throw new Error("Presentation content not found in stable storage.");

      const p = { ...meta, ...payload };
      const presPath = `${this.config.basePath}/${presId}`;
      
      // 2. Sync Slides metadata
      const slidesContent = btoa(unescape(encodeURIComponent(JSON.stringify(p, null, 2))));
      let slidesSha = null;
      try {
        const existing = await this.apiCall(`${presPath}/slides.json`);
        if (existing) slidesSha = existing.sha;
      } catch(e){}

      await this.apiCall(`${presPath}/slides.json`, 'PUT', {
        message: `Sync slides: ${p.name}`,
        content: slidesContent,
        sha: slidesSha
      });

      // 3. Sync individual Assets
      for (const name in uploadedFiles) {
        const file = uploadedFiles[name];
        if (!file.data || !file.data.startsWith('data:')) continue;

        const assetPath = `${presPath}/assets/${name}`;
        let assetSha = null;
        try {
          const existing = await this.apiCall(assetPath);
          if (existing) assetSha = existing.sha;
        } catch(e){}

        const parts = file.data.split(',');
        const b64 = parts[1];

        await this.apiCall(assetPath, 'PUT', {
          message: `Sync asset: ${name}`,
          content: b64,
          sha: assetSha
        });
      }

      toast('Cloud Folder Sync Complete!');
      if (typeof closeModal === 'function') closeModal('syncModal');
    } catch (err) {
      console.error(err);
      showAlert('Upload Failed', err.message);
    }
  },

  async download() {
    if (!this.isConnected()) return;

    try {
      toast('Scanning cloud library...');
      // 1. List presentations directory
      const items = await this.apiCall(this.config.basePath);
      if (!items || !Array.isArray(items)) {
        // Fallback discovery for old single-file sync
        const legacy = await this.apiCall('presentations.json');
        if (legacy) {
          const content = legacy.content.replace(/\s/g, '');
          const data = JSON.parse(decodeURIComponent(escape(atob(content))));
          this.finalizeMerge(data);
          return;
        }
        toast('No cloud folders found.');
        return;
      }

      const remoteLibrary = [];

      for (const item of items) {
        if (item.type === 'dir') {
          try {
            const slidesFile = await this.apiCall(`${item.path}/slides.json`);
            if (slidesFile) {
              const content = slidesFile.content.replace(/\s/g, '');
              const pres = JSON.parse(decodeURIComponent(escape(atob(content))));
              
              // Load asset metadata references
              const assetsDir = await this.apiCall(`${item.path}/assets`);
              if (assetsDir && Array.isArray(assetsDir)) {
                 pres.uploadedFiles = pres.uploadedFiles || {};
                 for (const assetDoc of assetsDir) {
                    if (!pres.uploadedFiles[assetDoc.name]) {
                       pres.uploadedFiles[assetDoc.name] = { name: assetDoc.name, data: '[stored_in_idb]' };
                    }
                    // Fetch actual data and store in AssetDB
                    const assetData = await this.apiCall(assetDoc.path);
                    if (assetData) {
                       const ext = assetDoc.name.split('.').pop().toLowerCase();
                       let mime = 'image/png';
                       if (ext === 'mp4' || ext === 'webm') mime = `video/${ext}`;
                       else if (ext === 'html') mime = 'text/html';
                       const b64 = assetData.content.replace(/\s/g, '');
                       const dataUrl = `data:${mime};base64,${b64}`;
                       await AssetDB.saveAsset(assetDoc.name, dataUrl, 'binary');
                    }
                 }
              }
              remoteLibrary.push(pres);
            }
          } catch(e) { console.warn(`Skipping ${item.name}:`, e); }
        }
      }

      this.finalizeMerge(remoteLibrary);
    } catch (err) {
      console.error(err);
      showAlert('Download Failed', err.message);
    }
  },

  finalizeMerge(remoteData) {
    const localData = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
    const merged = this.mergeLibraries(localData, remoteData);
    localStorage.setItem('slidepy_presentations', JSON.stringify(merged));
    if (typeof renderHomeScreen === 'function') renderHomeScreen();
    toast('Sync successful!');
    if (typeof closeModal === 'function') closeModal('syncModal');
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
