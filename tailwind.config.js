'use strict';

module.exports = {
  mode: 'jit',
  content: ['./frontend/src/**/*.html', './frontend/src/**/*.js'],
  corePlugins: {
    container: true
  },
  plugins: [],
  theme: {
    extend: {
      colors: {
        'puerto-rico': {
          '50': '#eefffb',
          '100': '#c6fff3',
          '200': '#8effe8',
          '300': '#4dfbdb',
          '400': '#15d4b7',
          '500': '#00ccb0',
          '600': '#00a491',
          '700': '#038276',
          '800': '#08675f',
          '900': '#0c554e',
          '950': '#003432',
        } 
      } 
    }
  }
};