import {Preset, Clean, CleanStylesheets, CleanJavascripts, Copy, Jekyll, CssNano, Sass, RollupEs, RollupUmd, RollupIife, ScssLint, EsLint, Aggregate, Uglify, parallel, series} from 'gulp-pipeline'

// since we are using a docs cwd, we need to grap the source path to watch both docs js and core js
import findup from 'findup-sync'
const coreJs = findup('js')
const coreScss = findup('scss')

const referenceDocNotice =
  `$1\n
[//]: # DO NOT EDIT IT WILL BE OVERWRITTEN - copy of bootstrap documentation generated by gulp docs:copy:bs-docs\n
{% callout info %}\n**Bootstrap Reference Documentation**
This is a part of the reference documentation from <a href="http://getbootstrap.com">Bootstrap</a>.
It is included here to demonstrate rendering with Material Design for Bootstrap default styling.
See the <a href="/material-design/buttons">Material Design</a> section for more elements and customization options.
{% endcallout %}
\n\n$2`

const copyProcessor = (content, srcpath) => { // https://regex101.com/r/cZ7aO8/2
  return content
    .replace(/(---[\s\S]+?---)([\s\S]+)/mg, referenceDocNotice) // insert docs reference
    .replace(/Fancy display heading/, 'Fancy heading')          // remove sample text 'display' as this is a particular MD style and is confusing
}

const preset = Preset.baseline({
  javascripts: {
    source: {options: {cwd: 'docs/assets/js/src'}},
    watch: {options: {cwd: 'docs/assets/js/src'}},
    test: {options: {cwd: 'docs/assets/js/tests'}},
    dest: 'docs/dist'
  },
  stylesheets: {
    source: {options: {cwd: 'docs/assets/scss'}},
    watch: {options: {cwd: 'docs/assets/scss'}},
    dest: 'docs/dist'
  },
  images: {
    dest: 'docs/dist'
  },
  postProcessor: {
    source: {options: {cwd: 'docs/dist'}},
    watch: {options: {cwd: 'docs/dist'}},
    dest: 'docs/dist'
  }
})

const prefix = {task: {prefix: 'docs:'}}

export default function (gulp, corePreset, options) {

  const js = new Aggregate(gulp, 'js',
    series(gulp,
      parallel(gulp,
        new CleanJavascripts(gulp, preset, prefix, {task: false}), // just here to trigger jekyll refresh
        new EsLint(gulp, preset, prefix),
        new EsLint(gulp, corePreset, {task: false}) // lint the core as well - easier for development - and adds watch
      ),
      parallel(gulp,
        new RollupIife(gulp, preset, prefix, options.rollupConfig, {
          options: {
            dest: 'docs.iife.js',
            moduleName: 'docs'
          }
        }),
        new Uglify(gulp, preset, prefix, {
          task: {name: 'vendor:uglify'},
          source: {options: {cwd: 'docs/assets/js/vendor'}},
          concat: {dest: 'docs-vendor.min.js'}
        })
      ),
      new Uglify(gulp, preset, prefix, {
        task: {name: 'iife:uglify'},
        source: {glob: '*.iife.js', options: {ignore: ['*.iife.min.js', 'bootstrap*.js']}}
      })
    ),
    prefix)

  const css = new Aggregate(gulp, 'css',
    series(gulp,
      parallel(gulp,
        new CleanStylesheets(gulp, preset, prefix, {task: false}), // just here to trigger jekyll refresh
        new ScssLint(gulp, preset, prefix, {
          source: {glob: ['**/*.scss', '!docs.scss']},
          watch: {glob: ['**/*.scss', '!docs.scss']}
        }),
        new ScssLint(gulp, corePreset, {task: false}) // lint the core as well - easier for development - and adds watch
      ),
      new Sass(gulp, preset, prefix),
      new CssNano(gulp, preset, prefix)
    ),
    prefix)

  const defaultRecipes = new Aggregate(gulp, 'default',
    parallel(gulp,
      css,
      js
    ),
    prefix, {debug: false})

  // docs copy
  new Aggregate(gulp, 'copy:bs-docs',
    parallel(gulp,
      new Copy(gulp, preset, prefix, {
        task: false, //{name: 'copy:bs-docs-content'},
        source: {
          options: {cwd: '../bootstrap/docs/content'},
          glob: ['**/*']
        },
        dest: 'docs/content/',
        process: copyProcessor
      }),
      new Copy(gulp, preset, prefix, {
        task: false, //{name: 'copy:bs-docs-components'},
        source: {
          options: {cwd: '../bootstrap/docs/components'},
          glob: ['**/*']
        },
        dest: 'docs/components/',
        process: copyProcessor
      }),
      new Copy(gulp, preset, prefix, {
        task: false, //{name: 'copy:bs-docs-scss'},
        source: {
          options: {cwd: '../bootstrap/docs/assets/scss'},
          glob: ['**/*', '!docs.scss'] // keep variable customizations
        },
        dest: 'docs/assets/scss/',
        process: (content, srcpath) => {
          return content.replace(/([\s\S]+)/mg, '// DO NOT EDIT IT WILL BE OVERWRITTEN - copy of bootstrap documentation generated by gulp docs:copy:bs-docs\n\n$1');
        }
      }),
      new Copy(gulp, preset, prefix, {
        task: false, //{name: 'copy:bs-docs-plugins'},
        source: {
          options: {cwd: '../bootstrap/docs/_plugins'},
          glob: ['**/*', '!bridge.rb']
        },
        dest: 'docs/_plugins/'
      }),
      new Copy(gulp, preset, prefix, {
        task: false, //{name: 'copy:bs-docs-js-vendor'},
        source: {
          options: {cwd: '../bootstrap/docs/assets/js/vendor'},
          glob: [
            '**/*',
            '!tether.min.js',
            '!jquery.min.js'
          ]
        },
        dest: 'docs/assets/js/vendor/'
      }, prefix)
    ),
    prefix)

  return defaultRecipes
}
