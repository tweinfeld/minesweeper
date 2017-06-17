const
    path = require('path'),
    webpack = require('webpack'),
    HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/js/web_interface.js',
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('production')
            }
        }),
        new webpack.optimize.UglifyJsPlugin(),
        new HtmlWebpackPlugin({
            title: "Minesweeper",
            template: "./src/index.ejs",
            _uaTrackerId: "UA-1155730-4",
            _addThisId: "ra-5944e3ada48860df"
        })
    ],
    output: {
        filename: 'minesweeper.js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['env']
                    }
                }
            },
            {
                test: /\.less$/,
                use: [{
                    loader: "style-loader"
                },
                    {
                        loader: "css-loader", options: {
                        url: false
                    }

                    }, {
                        loader: "less-loader", options: {
                            ieCompat: false
                        }
                    }]
            }]
    }
};