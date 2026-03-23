(function(global){
  const KEY = 'kedrix_session_v1';
  const TTL_MS = 1000 * 60 * 60 * 12;
  function randomId(){
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
    } catch(_e) {
      return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }
  function read(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(_e) { return null; }
  }
  function write(state){
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
  function valid(state){
    return !!(state && state.id && state.expiresAt && Number(state.expiresAt) > Date.now());
  }
  const manager = {
    ensure(){
      const current = read();
      if (valid(current)) return current;
      return write({ id: randomId(), issuedAt: Date.now(), expiresAt: Date.now() + TTL_MS });
    },
    refresh(){
      const state = this.ensure();
      state.expiresAt = Date.now() + TTL_MS;
      return write(state);
    },
    invalidate(){
      localStorage.removeItem(KEY);
    },
    getSessionId(){
      return this.ensure().id;
    }
  };
  manager.ensure();
  global.KedrixSessionManager = manager;
  global.getSessionId = function(){
    try {
      return global.KedrixSessionManager && typeof global.KedrixSessionManager.getSessionId === 'function'
        ? global.KedrixSessionManager.getSessionId()
        : null;
    } catch(_e) {
      return null;
    }
  };
})(window);