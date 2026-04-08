// pbxManager.js

const { PBXInstance } = require('./instance/pbx.instance')
const { pbxConfigs } = require('../config/pbx.config')

class PBXManager {
  constructor() {
    this.instances = new Map()
  }

  // Equivalent of OnModuleInit()
  async init() {
    console.log('Initializing PBX connections...')
    for (const config of pbxConfigs) {
      await this.initializePBX(config)
    }
  }

  async initializePBX(config) {
    const instance = new PBXInstance(config)
    await instance.connect()
    this.instances.set(config.id, instance)
  }

  getInstance(id) {
    return this.instances.get(id)
  }

  async getExtensions(pbxId) {
    const instance = this.getInstance(pbxId)
    if (!instance) {
      throw new Error(`PBX ${pbxId} not found`)
    }
    return instance.request('extension/list')
  }
}

module.exports = new PBXManager()