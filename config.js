// config.js

const pbxConfigs = [
    {
      id: 'yeastar-main',
      ip: process.env.YEASTAR_IP || 'labs1.ras.yeastar.com',
      username: process.env.YEASTAR_USERNAME || 'ZaJKMAXvH5o0yAJbP0P1aHWYUBIHFPBd',
      password: process.env.YEASTAR_PASSWORD || 'EPofnIC16ksnbCPSVvKovzCJjLwaSVmE'
    }
  ]
  
  module.exports = {
    voiceflow: {
      apiKey: process.env.VOICEFLOW_API_KEY,
      projectId: process.env.VOICEFLOW_PROJECT_ID,
      versionId: process.env.VOICEFLOW_VERSION_ID || 'production',
      baseUrl: 'https://general-runtime.voiceflow.com'
    },
  
    pbxConfigs,   // 👈 Now yeastar is part of PBX configs
  
    server: {
      port: process.env.PORT || 4000
    }
  }

  module.exports = {
    pbxConfigs
  }