module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    uglify: {
      options: {
        banner: '/*\n<%= grunt.file.read("banner.txt") %> \n*/'
      },
      build: {
        src: 'target/js/<%= pkg.name %>.js',
        dest: 'target/js/<%= pkg.name %>.min.js'
      }
    },

    typescript: {
      base: {
        src: ['src/main/ts/*.ts'],
        dest: 'target/js/ayttm.js',
        options: {
          target: 'es5', //or es3
          basePath: 'src/main/ts',
          sourceMap: true,
          declaration: true
        }
      }
    },

    jasmine: {
        test: {
            src: 'target/js/ayttm.min.js',
            options: {
                specs: 'src/test/ayttm/Spec*.js'
            }
        }
    }

  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-contrib-jasmine');

  // Default task(s).
  grunt.registerTask('default', ['typescript', 'uglify', 'jasmine']);

};
