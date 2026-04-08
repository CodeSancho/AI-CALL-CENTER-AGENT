class PBXManager {
    constructor() {
      this.instances = new Map()
    }
  
    async init() {
      console.log('Initializing PBX connections...')
    }
  }
  
  module.exports = new PBXManager()