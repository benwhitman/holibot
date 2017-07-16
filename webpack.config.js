var path = require('path');
var webpack = require('webpack');
const UglifyEsPlugin = require('uglify-es-webpack-plugin');

module.exports = {
  entry: './handler.ts',
  target: 'node',
  module: {
    loaders: [
      { test: /\.ts(x?)$/, loader: 'ts-loader' },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  plugins: [
    new webpack.IgnorePlugin(/\.md$|\.jst$|\.def$|\.d\.ts$/),
    //new UglifyEsPlugin()
  ],
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '']
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: 'handler.js'
  }
};