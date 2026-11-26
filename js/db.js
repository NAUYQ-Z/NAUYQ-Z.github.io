/* 本地存储：IndexedDB 为主，隐私模式 / file:// 某些情况下退回 localStorage。 */
(function () {
  var DB_NAME = 'tarotnotes';
  var DB_VER = 1;
  var dbp = null;
  var memory = { records: [], kv: {} };
  var useFallback = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) return reject(new Error('no idb'));
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('records')) {
          var s = db.createObjectStore('records', { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb error')); };
      req.onblocked = function () { reject(new Error('idb blocked')); };
    }).catch(function (err) {
      useFallback = true;
      loadFallback();
      throw err;
    });
    return dbp;
  }

  function loadFallback() {
    try {
      var raw = localStorage.getItem('tarotnotes.fallback');
      if (raw) memory = JSON.parse(raw);
    } catch (e) { /* 读不出来就当空的 */ }
  }
  function saveFallback() {
    try { localStorage.setItem('tarotnotes.fallback', JSON.stringify(memory)); } catch (e) { /* 满了就算了 */ }
  }

  function tx(store, mode) {
    return open().then(function (db) {
      var t = db.transaction(store, mode);
      return t.objectStore(store);
    });
  }

  var Store = {
    ready: function () { return open().catch(function () { return null; }); },

    records: function () {
      if (useFallback) return Promise.resolve(memory.records.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }));
      return tx('records', 'readonly').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.getAll();
          req.onsuccess = function () {
            var list = req.result || [];
            list.sort(function (a, b) { return b.createdAt - a.createdAt; });
            resolve(list);
          };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { return memory.records.slice(); });
    },

    put: function (rec) {
      if (useFallback) {
        var i = memory.records.findIndex(function (r) { return r.id === rec.id; });
        if (i >= 0) memory.records[i] = rec; else memory.records.push(rec);
        saveFallback();
        return Promise.resolve(rec);
      }
      return tx('records', 'readwrite').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.put(rec);
          req.onsuccess = function () { resolve(rec); };
          req.onerror = function () { reject(req.error); };
        });
      });
    },

    putMany: function (list) {
      if (!list.length) return Promise.resolve(0);
      if (useFallback) {
        list.forEach(function (rec) {
          var i = memory.records.findIndex(function (r) { return r.id === rec.id; });
          if (i >= 0) memory.records[i] = rec; else memory.records.push(rec);
        });
        saveFallback();
        return Promise.resolve(list.length);
      }
      return tx('records', 'readwrite').then(function (s) {
        return new Promise(function (resolve, reject) {
          list.forEach(function (rec) { s.put(rec); });
          s.transaction.oncomplete = function () { resolve(list.length); };
          s.transaction.onerror = function () { reject(s.transaction.error); };
        });
      });
    },

    del: function (id) {
      if (useFallback) {
        memory.records = memory.records.filter(function (r) { return r.id !== id; });
        saveFallback();
        return Promise.resolve();
      }
      return tx('records', 'readwrite').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.delete(id);
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      });
    },

    getKV: function (key, def) {
      if (useFallback) return Promise.resolve(key in memory.kv ? memory.kv[key] : def);
      return tx('kv', 'readonly').then(function (s) {
        return new Promise(function (resolve) {
          var req = s.get(key);
          req.onsuccess = function () { resolve(req.result === undefined ? def : req.result); };
          req.onerror = function () { resolve(def); };
        });
      }).catch(function () { return def; });
    },

    setKV: function (key, val) {
      if (useFallback) { memory.kv[key] = val; saveFallback(); return Promise.resolve(); }
      return tx('kv', 'readwrite').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.put(val, key);
          req.onsuccess = function () { resolve(); };
          req.onerror = function () { reject(req.error); };
        });
      }).catch(function () { memory.kv[key] = val; saveFallback(); });
    }
  };

  window.Store = Store;
})();
