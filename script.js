// script.js
// Simple gallery using IndexedDB to store image Blobs locally on the user's device.
// This keeps uploads private to each visitor's browser (no server). Good for demos and local use.

const DB_NAME = 'galleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
let db;

// open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function addImageBlob(name, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = { name, blob, created: Date.now() };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getAllImages() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function deleteImageById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function clearAllImages() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

/* UI logic */
const fileElem = document.getElementById('fileElem');
const dropArea = document.getElementById('drop-area');
const uploadPreview = document.getElementById('upload-preview');
const galleryGrid = document.getElementById('galleryGrid');
const clearAllBtn = document.getElementById('clearAll');

function preventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
['dragenter','dragover','dragleave','drop'].forEach(evt=>{
  dropArea.addEventListener(evt, preventDefaults, false);
});

dropArea.addEventListener('drop', (e)=>{
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
});

fileElem.addEventListener('change', (e)=>{
  handleFiles(e.target.files);
});

function handleFiles(files){
  const arr = Array.from(files);
  arr.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    // show preview
    const reader = new FileReader();
    reader.onload = () => {
      const div = document.createElement('div');
      div.className = 'preview-thumb';
      div.style.display = 'inline-block';
      div.innerHTML = `<img src="${reader.result}" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"/>`;
      uploadPreview.appendChild(div);
    };
    reader.readAsDataURL(file);

    // store as blob
    const blob = file.slice(0, file.size, file.type);
    addImageBlob(file.name, blob).then(() => {
      refreshGallery();
    }).catch(err => console.error('DB add error', err));
  });
  // clear file input
  fileElem.value = '';
}

async function refreshGallery(){
  const items = await getAllImages();
  // sort newest first
  items.sort((a,b) => b.created - a.created);
  galleryGrid.innerHTML = '';
  if (!items.length) {
    galleryGrid.innerHTML = '<p class="muted small">No photos yet — add some above.</p>';
    return;
  }
  for (const item of items) {
    const imgURL = URL.createObjectURL(item.blob);
    const el = document.createElement('div');
    el.className = 'card-item';
    el.innerHTML = `
      <a href="${imgURL}" target="_blank" rel="noopener noreferrer"><img alt="${escapeHtml(item.name||'photo')}" src="${imgURL}"></a>
      <div class="meta">
        <div class="meta-left">${escapeHtml(item.name||'Untitled')}</div>
        <div class="meta-right">
          <button class="btn ghost" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `;
    galleryGrid.appendChild(el);
    // cleanup URL when item removed or page unloads (handled when page reloads)
    el.querySelector('button').addEventListener('click', async (ev)=>{
      ev.preventDefault();
      const id = Number(ev.currentTarget.dataset.id);
      if (!confirm('Delete this image from your device?')) return;
      await deleteImageById(id);
      refreshGallery();
    });
  }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (c)=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]); }

clearAllBtn.addEventListener('click', async ()=>{
  if (!confirm('Clear all gallery images stored in this browser? This cannot be undone.')) return;
  await clearAllImages();
  refreshGallery();
});

// init
(async function init(){
  try {
    await openDB();
    refreshGallery();
  } catch (e) {
    console.error('Failed to open DB', e);
    galleryGrid.innerHTML = '<p class="muted">Browser storage is not available in this environment.</p>';
  }
})();
