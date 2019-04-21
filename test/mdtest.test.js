'use strict'

const Path = require('path')
const {assert} = require('chai')
const tmp = require('tmp')
const Mdtest = require('../src')

describe('Mdtest', () => {
  let testDir
  before(() => {
    testDir = tmp.dirSync({
      prefix: 'node-mdtest-test-',
      unsafeCleanup: true,
    }).name
  })

  describe('#run', () => {
    it('should return results has parsable "stdout" property', async () => {
      const mdtest = new Mdtest()
      mdtest
        .hostfile(
          new Mdtest.HostFile()
            .host('localhost', {
              slots: 2,
            }))
        .np(2)
        .testDir(testDir)
        .numberOfItemsPerProcess(10)

      const results = await mdtest.run()
      assert.isObject(results)

      const parsed = Mdtest.parse(results.stdout)
      assert.isObject(parsed)

      // console.log(results)
      // console.log(require('util').inspect(parsed, { depth: null }));
    })

    it('should return help message', async () => {
      const mdtest = new Mdtest()
      mdtest.mdtestOptions({'-h': true})
      assert.ok(await mdtest.run())
      // console.log(await mdtest.run())
    })
  })

  describe('#testDir', () => {
    it('should set -d option ends with a platform specific path segment separator', () => {
      const mdtest = new Mdtest()
      mdtest
        .testDir('/tmp')
      assert.strictEqual(mdtest._mdtestOptions['-d'], `/tmp${Path.sep}`)
    })
  })

  describe('parse', () => {
    it('should throw an Error', () => {
      assert.throws(Mdtest.parse)
    })

    it('should parse the results of mdtest', () => {
      const results =
`-- started at 05/27/2018 04:07:15 --

mdtest-1.9.3 was launched with 4 total task(s) on 1 node(s)
Command line used: mdtest -n 3
Path: /tmp/dummy
FS: 244.0 GiB   Used FS: 32.3%   Inodes: 15.5 Mi   Used Inodes: 9.2%

4 tasks, 12 files/directories

SUMMARY: (of 1 iterations)
   Operation                      Max            Min           Mean        Std Dev
   ---------                      ---            ---           ----        -------
   Directory creation:     113501.114     113501.114     113501.114          0.000
   Directory stat    :     789830.624     789830.624     789830.624          0.000
   Directory removal :      81351.011      81351.011      81351.011          0.000
   File creation     :     241789.498     241789.498     241789.498          0.000
   File stat         :    1785168.770    1785168.770    1785168.770          0.000
   File read         :    1155182.167    1155182.167    1155182.167          0.000
   File removal      :     270385.896     270385.896     270385.896          0.000
   Tree creation     :        111.431        111.431        111.431          0.000
   Tree removal      :      17801.866      17801.866      17801.866          0.000

-- finished at 05/27/2018 04:07:15 --`

      assert.deepStrictEqual(
        Mdtest.parse(results),
        {
          metadata: {
            timestamp: {
              started: '05/27/2018 04:07:15',
              finished: '05/27/2018 04:07:15',
            },
            version: '1.9.3',
            tasks: 4,
            nodes: 1,
            items: 12,
            commandLine: 'mdtest -n 3',
            path: '/tmp/dummy',
            fs: {
              total: '244.0 GiB',
              used: '32.3%',
            },
            inodes: {
              total: '15.5 Mi',
              used: '9.2%',
            },
          },
          summary: {
            iterations: 1,
            directory: {
              creation: {
                max: '113501.114',
                min: '113501.114',
                mean: '113501.114',
                stdDev: '0.000',
              },
              stat: {
                max: '789830.624',
                min: '789830.624',
                mean: '789830.624',
                stdDev: '0.000',
              },
              removal: {
                max: '81351.011',
                min: '81351.011',
                mean: '81351.011',
                stdDev: '0.000',
              },
            },
            file: {
              creation: {
                max: '241789.498',
                mean: '241789.498',
                min: '241789.498',
                stdDev: '0.000',
              },
              read: {
                max: '1155182.167',
                mean: '1155182.167',
                min: '1155182.167',
                stdDev: '0.000',
              },
              removal: {
                max: '270385.896',
                mean: '270385.896',
                min: '270385.896',
                stdDev: '0.000',
              },
              stat: {
                max: '1785168.770',
                mean: '1785168.770',
                min: '1785168.770',
                stdDev: '0.000',
              },
            },
            tree: {
              creation: {
                max: '111.431',
                mean: '111.431',
                min: '111.431',
                stdDev: '0.000',
              },
              removal: {
                max: '17801.866',
                mean: '17801.866',
                min: '17801.866',
                stdDev: '0.000',
              },
            },
          },
        })
    })

    it('should parse the results of mdtest -F', () => {
      const results =
`-- started at 05/27/2018 06:00:48 --

mdtest-1.9.3 was launched with 1 total task(s) on 1 node(s)
Command line used: mdtest -F
Path: /tmp/dummy
FS: 244.0 GiB   Used FS: 32.3%   Inodes: 15.5 Mi   Used Inodes: 9.2%

1 tasks, 0 files

SUMMARY: (of 1 iterations)
   Operation                      Max            Min           Mean        Std Dev
   ---------                      ---            ---           ----        -------
   File creation     :          0.000          0.000          0.000          0.000
   File stat         :          0.000          0.000          0.000          0.000
   File read         :          0.000          0.000          0.000          0.000
   File removal      :          0.000          0.000          0.000          0.000
   Tree creation     :      80006.097      80006.097      80006.097          0.000
   Tree removal      :      62649.036      62649.036      62649.036          0.000

-- finished at 05/27/2018 06:00:48 --`
      const parsed = Mdtest.parse(results)
      assert.deepNestedInclude(parsed, {
        'summary.file.creation.max': '0.000',
        'summary.tree.creation.min': '80006.097',
        'summary.tree.removal.mean': '62649.036',
      })
      assert.notNestedProperty(parsed, 'summary.directory')
      // console.log(require('util').inspect(parsed, { depth: null }));
    })
  })
})
