'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  const defaultSupabaseUrl='https://rqvcbjomrjccyuchxpuh.supabase.co';
  const defaultPublishableKey='sb_publishable_iKh-ZfqV3iJpr_9b7SErEA_XhrqnSsY';
  window.FRP_CLOUD_CONFIG=Object.freeze({
    supabaseUrl:shared.supabaseUrl||defaultSupabaseUrl,
    supabasePublishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||defaultPublishableKey,
    appKey:'fluchtplan',
    storageKey:'fluchtplan-studio-v2'
  });
})();
