'use strict'
const util = require('util')
const Path = require('path')
const execFile = util.promisify(require('child_process').execFile)
const HostFile = require('./host-file')

const MDTEST_PHASE = {
  write: Symbol('write'),
  stat: Symbol('stat'),
  read: Symbol('read'),
  delete: Symbol('delete'),
}

class Mdtest {
  static get HARD_FILE_SIZE () {
    return 3901
  }

  static get PHASE () {
    return MDTEST_PHASE
  }

  static get DEFAULT_MPIRUN_OPTIONS () {
    return {
      '-np': 1,
      '-map-by': 'node',
      '-rank-by': 'slot',
      '-nooversubscribe': true,
    }
  }

  static get HostFile () {
    return HostFile
  }

  static parse (str) {
    const matchFs = throwParseErrorIfNull(str.match(
      /FS: (.+?)\s+Used FS: (.+%)\s+Inodes: (.+?)\s+Used Inodes: (.+%)/))

    const results = {
      metadata: {
        timestamp: {
          started: throwParseErrorIfNull(
            str.match(/-- started at (.+) --/))[1],
          finished: throwParseErrorIfNull(
            str.match(/-- finished at (.+) --/))[1],
        },
        version: throwParseErrorIfNull(
          str.match(/mdtest-(.+) was launched with/))[1],
        tasks: parseInt(throwParseErrorIfNull(
          str.match(/was launched with (\d+) total task/))[1], 10),
        nodes: parseInt(throwParseErrorIfNull(
          str.match(/total task\(s\) on (\d+) node/))[1], 10),
        items: parseInt(throwParseErrorIfNull(
          str.match(/(?:\d+) tasks, (\d+) (?:files)?\/?(?:directories)?/))[1], 10),
        commandLine: throwParseErrorIfNull(
          str.match(/Command line used: (.+)/))[1],
        path: throwParseErrorIfNull(
          str.match(/Path: (.+)/))[1],
        fs: {
          total: matchFs[1],
          used: matchFs[2],
        },
        inodes: {
          total: matchFs[3],
          used: matchFs[4],
        },
      },
      summary: {
        iterations: parseInt(throwParseErrorIfNull(
          str.match(/SUMMARY(?: rate)?: \(of (\d+) iterations\)/))[1], 10),
      },
    }

    const directory = createOperationResults(str, 'Directory', [
      'creation', 'stat', 'removal',
    ])

    const file = createOperationResults(str, 'File', [
      'creation', 'stat', 'read', 'removal',
    ])

    const tree = createOperationResults(str, 'Tree', [
      'creation', 'removal',
    ])

    Object.assign(results.summary,
      directory && { directory },
      file && { file },
      tree && { tree })

    return results

    function throwParseErrorIfNull (matchResult) {
      if (!matchResult) { throw new Error('Mdtest parse error') }
      return matchResult
    }

    function parseOperation (str, operation) {
      const matchOperation = str.match(new RegExp(
        `${operation}\\s*:\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)`))
      return matchOperation
        ? {
          max: matchOperation[1],
          min: matchOperation[2],
          mean: matchOperation[3],
          stdDev: matchOperation[4],
        }
        : null
    }

    function createOperationResults (str, type, operations) {
      const results = operations.reduce((acc, operation) => {
        const parsed = parseOperation(str, `${type} ${operation}`)
        if (parsed) {
          acc[operation] = parsed
        }
        return acc
      }, {})
      return Object.keys(results).length !== 0
        ? results
        : null
    }
  }

  constructor (options = {}) {
    this.mpirunPath = options.mpirunPath || 'mpirun'
    this.mdtestPath = options.mdtestPath || 'mdtest'

    this._mpirunOptionsRaw = []
    this._mpirunOptions = Mdtest.DEFAULT_MPIRUN_OPTIONS
    this._mdtestOptions = {}

    this._hostFile = new HostFile()
  }

  mpirunOptionsRaw (raw) {
    this._mpirunOptionsRaw = raw.slice(/\s+/)
  }

  mpirunOptions (options) {
    Object.assign(this._mpirunOptions, options || {})
    return this
  }

  hostfile (obj) {
    if (!(obj instanceof HostFile)) {
      throw new Error('hostfile must be instance of Mdtest.HostFile')
    }
    this._hostFile = obj
    return this
  }

  np (n) {
    n = n || Mdtest.DEFAULT_MPIRUN_OPTIONS['-np']
    return this.mpirunOptions({ '-np': n })
  }

  mdtestOptions (options) {
    Object.assign(this._mdtestOptions, options || {})
    return this
  }

  testDir (path) {
    return this.mdtestOptions({
      '-d': Path.join(path, Path.sep),
    })
  }

  d (path) {
    return this.testDir(path)
  }

  numberOfItemsPerProcess (n) {
    return this.mdtestOptions({ '-n': n })
  }

  n (n) {
    return this.numberOfItemsPerProcess(n)
  }

  unique (b = true) {
    return this.mdtestOptions({ '-u': !!b })
  }

  onlyFiles () {
    return this.mdtestOptions({
      '-F': true,
      '-D': false,
    })
  }

  onlyDirs () {
    return this.mdtestOptions({
      '-F': false,
      '-D': true,
    })
  }

  onlyPhase (phase) {
    this.mdtestOptions({
      '-C': false,
      '-T': false,
      '-E': false,
      '-r': false,
    })
    switch (phase) {
      case Mdtest.PHASE.write:
        return this.mdtestOptions({ '-C': true })
      case Mdtest.PHASE.stat:
        return this.mdtestOptions({ '-T': true })
      case Mdtest.PHASE.read:
        return this.mdtestOptions({ '-E': true })
      case Mdtest.PHASE.delete:
        return this.mdtestOptions({ '-r': true })
      default:
        throw new Error('invalid phase')
    }
  }

  hard () {
    return this.mdtestOptions({
      '-t': true,
      '-w': Mdtest.HARD_FILE_SIZE,
      '-e': Mdtest.HARD_FILE_SIZE,
    })
      .onlyFiles()
  }

  _convertToArray (options = {}) {
    return Object.keys(options).reduce((acc, key) => {
      const val = options[key]
      if (typeof val === 'boolean') {
        if (val) {
          acc.push(key)
        }
      } else {
        acc.push(key, val)
      }
      return acc
    }, [])
  }

  async run () {
    const hostfile = this._hostFile.length
      ? this._hostFile.createTmpFile()
      : null

    if (hostfile) {
      this.mpirunOptions({ '-hostfile': hostfile.name })
    }

    const args = [
      ...this._mpirunOptionsRaw,
      ...this._convertToArray(this._mpirunOptions),
      this.mdtestPath,
      ...this._convertToArray(this._mdtestOptions),
    ]

    // console.log(`${this.mpirunPath} ${args.join(' ')}`)
    const results = await execFile(this.mpirunPath, args)
    const results = {}

    results.cmd = `${this.mpirunPath} ${args.join(' ')}`
    results.hostfile = this._hostFile.stringify()

    if (hostfile) {
      hostfile.removeCallback()
    }

    return results
  }
}

module.exports = Mdtest
