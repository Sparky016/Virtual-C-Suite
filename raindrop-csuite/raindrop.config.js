module.exports = {
  name: 'Virtual C-Suite',
  description: 'A virtual C-Suite application for executive management',
  version: '1.0.0',
  entry: 'src/index.js',
  output: {
    path: 'dist',
    filename: 'bundle.js'
  },
  plugins: [],
  devServer: {
    port: 3000
  }
};