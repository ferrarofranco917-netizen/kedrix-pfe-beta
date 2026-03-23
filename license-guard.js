(function(global){
  const STORAGE_KEY = 'kedrix_guard_v1';
  function safeHash(input){
    let h = 2166136261;
    for (let i=0;i<input.length;i++){
      h ^= input.charCodeAt(i);
      h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24);
    }
    return ('0000000' + (h>>>0).toString(16)).slice(-8);
  }
  function computeFingerprint(){
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen.width || ''),
      String(screen.height || ''),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      navigator.platform || ''
    ];
    return safeHash(parts.join('|'));
  }
  function sign(payload){
    return safeHash(JSON.stringify(payload) + '::kedrix-beta-v1');
  }
  const guard = {
    getFingerprint(){ return computeFingerprint(); },
    sign,
    sealLicense(state){
      const sealed = { 
        email: state.email || '',
        testerId: state.testerId || '',
        status: state.status || '',
        expiresAt: state.expiresAt || '',
        fp: computeFingerprint()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ payload: sealed, sig: sign(sealed) }));
    },
    verifySeal(){
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (!raw || !raw.payload || !raw.sig) return false;
        if (raw.payload.fp !== computeFingerprint()) return false;
        return raw.sig === sign(raw.payload);
      } catch(_e) {
        return false;
      }
    },
    softInvalidate(reason){
      localStorage.setItem('kedrix_guard_reason', reason || 'unknown');
      localStorage.setItem('bw-license-valid', 'invalid');
    }
  };
  global.KedrixLicenseGuard = guard;
})(window);