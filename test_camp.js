const fs = require('fs');
// ... mock allMatches by calling supabase
const https = require('https');

const options = {
  hostname: 'hmaqdzkpjkxamggaiypo.supabase.co',
  path: '/rest/v1/matches?select=*&order=fecha.desc',
  headers: {
    "apikey": "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y", 
    "Authorization": "Bearer sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y"
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matchesJson = JSON.parse(data);
    const allMatches = matchesJson.map((m, i) => ({
        AÑO: m.fecha ? m.fecha.split('-')[0] : '',
        torneo_base: m.torneo || '',
        INSTANCIA: m.instancia || '',
        VS: m.rival || ''
    }));
    
    const torMatches = allMatches.filter(m => m.AÑO === '2023' && (m.torneo_base.toUpperCase() === 'APERTURA'));
    console.log("Found matches for 2023 Apertura:", torMatches.length);
    console.log(torMatches[0]);
  });
});
