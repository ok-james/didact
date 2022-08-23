const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = {
  mode: "development",
  entry: {
    "didact": "./didact.js",
    "baby": "./my-baby.js",
  },
  devtool: "source-map",
  output: {
    filename: "[name].js",
    iife: true,
    clean: true,
  },
  module: {
    rules: [{
      test: /\.m?js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env", "@babel/preset-react"],
        },
      },
    }],
  },
  plugins: [new HtmlWebpackPlugin({
    template: "./index.html",
  })],
}