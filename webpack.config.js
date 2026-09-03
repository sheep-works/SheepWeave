const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');



/** @type WebpackConfig */
const nodeConfig = {
    mode: 'none',
    target: 'node',
    entry: {
        extension: './src/extension.ts',
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, './dist'),
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    },
    resolve: {
        alias: {
            '@sheep-family/types': path.resolve(__dirname, 'modules/SheepComb/packages/types/src/index.ts')
        },
        mainFields: ['module', 'main'],
        extensions: ['.ts', '.js'],
        extensionAlias: {
            '.js': ['.js', '.ts', '.tsx']
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    },
    externals: {
        'vscode': 'commonjs vscode',
    },
    performance: {
        hints: false
    },
    devtool: 'nosources-source-map',
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'modules/SheepComb/packages/core/src/pkg/sheep_spindle_bg.wasm'),
                    to: path.join(__dirname, 'dist')
                },
                {
                    from: path.join(__dirname, 'VersionLogs.md'),
                    to: path.join(__dirname, 'dist/VersionLogs.md'),
                    noErrorOnMissing: true
                }
            ]
        })
    ]
};

module.exports = [nodeConfig];
