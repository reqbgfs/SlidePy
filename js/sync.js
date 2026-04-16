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
    const url = isFullUrl
      ? endpoint
      : `https://api.github.com/repos/${this.config.repo}/contents/${endpoint || this.config.basePath}`;

    const headers = {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    const options = { method, headers };
    if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error (${response.status})`);
    }
    return response.status === 204 ? null : await response.json();
  },

  async fetchAccessibleRepos() {
    return await this.apiCall('https://api.github.com/user/repos?affiliation=owner,collaborator&sort=updated&per_page=100');
  },

  // Encode a UTF-8 string to base64 safely (chunk to avoid call stack limits)
  _toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  },

  // Decode a base64 string (possibly with whitespace) to UTF-8
  _fromBase64(b64) {
    const bytes = Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },

  // Guess MIME type from file extension
  _mimeFromExt(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      bmp: 'image/bmp', ico: 'image/x-icon',
      mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
      html: 'text/html', htm: 'text/html',
      py: 'text/x-python', js: 'text/javascript',
      css: 'text/css', txt: 'text/plain',
      json: 'application/json', csv: 'text/csv',
    };
    return map[ext] || 'application/octet-stream';
  },

  async upload() {
    if (!this.isConnected()) return;
    const presId = activePresentationId;
    if (!presId) { toast('Please open a presentation to sync.'); return; }

    try {
      await saveCurrentPresentation();

      const list = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
      const meta = list.find(x => x.id === presId);
      if (!meta) throw new Error('Presentation metadata not found.');

      const payload = await AssetDB.getPresentation(presId);
      if (!payload) throw new Error('Presentation content not found in stable storage.');

      const p = { ...meta, ...payload };
      const presPath = `${this.config.basePath}/${presId}`;

      // Upload slides.json
      const slidesContent = this._toBase64(JSON.stringify(p, null, 2));
      const existingSlides = await this.apiCall(`${presPath}/slides.json`);
      await this.apiCall(`${presPath}/slides.json`, 'PUT', {
        message: `Sync slides: ${p.name}`,
        content: slidesContent,
        ...(existingSlides ? { sha: existingSlides.sha } : {})
      });

      // Upload assets (skip IDB placeholders — hydrate from memory first)
      for (const name in uploadedFiles) {
        const file = uploadedFiles[name];
        let data = file.data;

        // Hydrate from IDB if still a placeholder
        if (!data || !data.startsWith('data:')) {
          const asset = await AssetDB.getAsset(name);
          if (asset) data = asset.data;
        }
        if (!data || !data.startsWith('data:')) continue;

        const assetPath = `${presPath}/assets/${name}`;
        const b64 = data.split(',')[1];
        if (!b64) continue;

        const existingAsset = await this.apiCall(assetPath);
        await this.apiCall(assetPath, 'PUT', {
          message: `Sync asset: ${name}`,
          content: b64,
          ...(existingAsset ? { sha: existingAsset.sha } : {})
        });
      }

      toast('Cloud Sync Complete!');
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

      const items = await this.apiCall(this.config.basePath);
      if (!items || !Array.isArray(items)) {
        toast('No cloud library found.');
        return;
      }

      // Fetch all remote presentations
      const remoteLibrary = [];
      for (const item of items) {
        if (item.type !== 'dir') continue;
        try {
          const slidesFile = await this.apiCall(`${item.path}/slides.json`);
          if (!slidesFile || !slidesFile.content) continue;

          const pres = JSON.parse(this._fromBase64(slidesFile.content));
          if (!pres.id) continue;

          // Collect asset file descriptors for later download
          const assetsDir = await this.apiCall(`${item.path}/assets`);
          pres._remoteAssets = (assetsDir && Array.isArray(assetsDir)) ? assetsDir : [];

          remoteLibrary.push(pres);
        } catch (e) {
          console.warn(`Skipping ${item.name}:`, e);
        }
      }

      if (remoteLibrary.length === 0) {
        toast('No presentations found in cloud library.');
        return;
      }

      const localList = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
      const localByName = new Set(localList.map(p => p.name));
      const localById = new Set(localList.map(p => p.id));

      // A conflict is any remote presentation already present locally (by ID or by name)
      const conflicts = remoteLibrary.filter(r => localById.has(r.id) || localByName.has(r.name));
      const newOnly   = remoteLibrary.filter(r => !localById.has(r.id) && !localByName.has(r.name));

      let toDownload;

      if (conflicts.length === 0) {
        toDownload = remoteLibrary;
      } else {
        const nameList = [...new Set(conflicts.map(c => `"${c.name}"`))] .join(', ');
        const confirmed = await showConfirm(
          'Conflict Detected',
          `${conflicts.length} presentation(s) already exist locally: ${nameList}. Overwrite them with the cloud version?`,
          'Overwrite',
          'Cancel'
        );
        toDownload = confirmed ? remoteLibrary : newOnly;
      }

      if (toDownload.length === 0) {
        toast('Nothing new to download.');
        return;
      }

      // Download assets and save everything to IDB
      for (const pres of toDownload) {
        pres.uploadedFiles = pres.uploadedFiles || {};

        for (const assetDoc of pres._remoteAssets) {
          const assetData = await this.apiCall(assetDoc.path);
          if (!assetData || !assetData.content) continue;

          const b64 = assetData.content.replace(/\s/g, '');
          const mime = this._mimeFromExt(assetDoc.name);
          const dataUrl = `data:${mime};base64,${b64}`;

          pres.uploadedFiles[assetDoc.name] = { name: assetDoc.name, data: '[stored_in_idb]', type: 'binary' };
          await AssetDB.saveAsset(assetDoc.name, dataUrl, 'binary');
        }

        // Save full presentation content to IDB
        await AssetDB.savePresentation(pres.id, {
          slides: pres.slides || [],
          uploadedFiles: pres.uploadedFiles,
          packages: pres.packages || DEFAULT_PACKAGES,
          customColorHistory: pres.customColorHistory || []
        });
      }

      // Merge only thin metadata into localStorage
      const newMeta = toDownload.map(p => ({
        id: p.id,
        name: p.name,
        savedAt: p.savedAt || Date.now(),
        _slideCount: p._slideCount || (p.slides || []).length,
        _pkgCount: p._pkgCount || 0
      }));

      const mergedList = [...localList];
      for (const meta of newMeta) {
        const idx = mergedList.findIndex(p => p.id === meta.id);
        if (idx >= 0) mergedList[idx] = meta;
        else mergedList.push(meta);
      }
      localStorage.setItem('slidepy_presentations', JSON.stringify(mergedList));

      if (typeof renderHomeScreen === 'function') renderHomeScreen();
      toast(`Downloaded ${toDownload.length} presentation${toDownload.length !== 1 ? 's' : ''}.`);
      if (typeof closeModal === 'function') closeModal('syncModal');
    } catch (err) {
      console.error(err);
      showAlert('Download Failed', err.message);
    }
  }
};
