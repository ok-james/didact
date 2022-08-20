const HtmlWebpackPlugin = require("html-webpack-plugin")
const path = require("path")

module.exports = {
  mode: "development",
  entry: "./didact.js",
  output: {
    filename: "index.js",
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