# @range3/mdtest
> A wrapper of the mdtest benchmark for Node.js

## Install
``` bash
$ yarn add @range3/mdtest
```
### Requirements
- Open MPI
- mdtest


## Usage
``` js
const Mdtest = require('@range3/mdtest')

;(async () => {
  const mdtest = new Mdtest({
    // mpirunPath: '/path/to/mpirun',
    // mdtestPath: '/path/to/mdtest',
  })
  mdtest
    // mpirun options
    .hostfile(
      new Mdtest.HostFile()
        .host('host1', {
          slots: 2,
        })
        .host('host2', {
          slots: 2,
        }))
    .np(4)
    .mpirunOptions({ // other mpirun options
      '-option': 'value',
    })
    // mdtest options
    .d('/path/to/dir')
    .n(100)
    // .unique(true) // -u
    // .onlyFiles() // -F
    // .onlyDirs() // -D
    // .onlyPhase(Mdtest.PHASE.write) // write, stat, read, delete
    // .hard() // io-500 mdtest-hard
    .mdtestOptions({ // other mdtest options
      '-option': 'value', // enable the option '-option value'
      '-C': true,  // enable the option '-C'
      '-F': false, // disable the option
    })

  const results = await mdtest.run()

  const parsedResults = Mdtest.parse(results.stdout)
})()
```
