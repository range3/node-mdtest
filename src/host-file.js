'use strict'

const fs = require('fs')
const tmp = require('tmp')

class HostFile {
  constructor () {
    this.clear()
  }

  clear () {
    this._hosts = {}
  }

  get length () {
    return Object.keys(this._hosts).length
  }

  host (name, options) {
    this._hosts[name] = options || {}
    return this
  }

  stringify () {
    return Object.keys(this._hosts).map(hostname => {
      const opts = Object.keys(this._hosts[hostname]).map(optName => {
        return `${optName}=${this._hosts[hostname][optName]}`
      }).join(' ')
      return `${hostname} ${opts}`
    }).join('\n')
  }

  createTmpFile (options) {
    const hostfile = tmp.fileSync(options)
    fs.writeFileSync(hostfile.name, this.stringify())
    return hostfile
  }
}

module.exports = HostFile
