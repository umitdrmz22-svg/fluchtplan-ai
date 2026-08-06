'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  window.FRP_CLOUD_CONFIG=Object.freeze({
    supabaseUrl:shared.supabaseUrl||'',
    supabasePublishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||'',
    appKey:'fluchtplan',
    storageKey:'fluchtplan-studio-v2'
  });
})();
