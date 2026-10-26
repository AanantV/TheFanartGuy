const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',

  entry: './src/index.jsx',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: 'auto',
    clean: true,
  },

  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3001,
    hot: true,
    open: true,
    // Forward API calls to the commission server (npm run server) during development.
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    ],
  },

  plugins: [
    // Address of the commission API for the built site. Empty = same site as the page.
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify(process.env.API_URL || ''),
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|mp4|webm)$/i,
        type: 'asset/resource',
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.jsx'],
  },
};