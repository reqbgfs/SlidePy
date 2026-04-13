// ═══════ ASSET & PRESENTATION INDEXEDDB STORAGE ═══════
const AssetDB = {
  dbName: 'SlidePyAssets',
  dbVersion: 2,
  stores: {
    assets: 'assets',
    presentations: 'presentations'
  },

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.stores.assets)) {
          db.createObjectStore(this.stores.assets, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(this.stores.presentations)) {
          db.createObjectStore(this.stores.presentations, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async saveAsset(name, data, type) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.assets, 'readwrite');
      tx.objectStore(this.stores.assets).put({ name, data, type, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getAsset(name) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.assets, 'readonly');
      const request = tx.objectStore(this.stores.assets).get(name);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllAssets() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.assets, 'readonly');
      const request = tx.objectStore(this.stores.assets).getAll();
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },
  
  async deleteAsset(name) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.assets, 'readwrite');
      tx.objectStore(this.stores.assets).delete(name);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  // Presentation Store Methods
  async savePresentation(id, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.presentations, 'readwrite');
      tx.objectStore(this.stores.presentations).put({ id, data, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async getPresentation(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.presentations, 'readonly');
      const request = tx.objectStore(this.stores.presentations).get(id);
      request.onsuccess = (e) => resolve(e.target.result ? e.target.result.data : null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async deletePresentation(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.stores.presentations, 'readwrite');
      tx.objectStore(this.stores.presentations).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
};

async function migrateAssetsToDB() {
  if (localStorage.getItem('slidepy_migrated_v2')) return;

  console.log("Starting TOTAL storage migration to IndexedDB...");
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('slidepy_presentations') || '[]');
  } catch(e) { return; }
  
  let migratedCount = 0;

  for (const pres of list) {
    // 1. Migrate Assets in this presentation
    if (pres.uploadedFiles) {
      for (const name in pres.uploadedFiles) {
        const file = pres.uploadedFiles[name];
        if (file.data && file.data.startsWith('data:')) {
          await AssetDB.saveAsset(name, file.data, file.type || 'binary');
          file.data = '[stored_in_idb]'; 
        }
      }
    }

    // 2. Migrate Slides/Metadata to dedicated Presentation store
    if (pres.slides && pres.slides.length > 0) {
      const payload = {
        slides: pres.slides,
        packages: pres.packages,
        uploadedFiles: pres.uploadedFiles
      };
      await AssetDB.savePresentation(pres.id, payload);
      
      // Strip heavy data from localStorage list
      delete pres.slides;
      delete pres.uploadedFiles;
      delete pres.packages;
      migratedCount++;
    }
  }

  // 3. Save the thinned-out "Table of Contents" to localStorage
  try {
    localStorage.setItem('slidepy_presentations', JSON.stringify(list));
    localStorage.setItem('slidepy_migrated_v2', 'true');
    console.log(`Successfully migrated ${migratedCount} presentations to IndexedDB.`);
  } catch(e) {
    console.warn("Could not save thinned list back to LocalStorage. It's truly full. Clearing it entirely as a reset.");
    // Emergency reset: if we can't even save the TOC, we keep IDB as source of truth and rebuild LS
    // But for now, we just warn.
  }
}
