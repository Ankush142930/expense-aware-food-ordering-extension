const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => ({
    entry: {
        background: './src/background/service-worker.js',
        content: './src/content/index.jsx',
        popup: './src/popup/index.jsx',
    },
    output: {
        path: path.resolve(__dirname, 'dist'), 
        filename: '[name].js',
        clean: true,
    }, 
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: { chrome: '120' }
                            }],
                            ['@babel/preset-react', {
                                runtime: 'automatic'
                            }],
                        ]
                    }
                }
            }, 
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            }
        ]
    }, 
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{
                from: 'public',
                to: '.',
            }],
        }),
    ],
    devtool: argv.mode === 'development' ? 'cheap-module-source-map' : false,
    optimization: { splitChunks: false },
})