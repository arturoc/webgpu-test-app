import { context } from "esbuild";
import ip from "ip";
import fs from "fs";
import http from "node:http";
import https from "node:https";

const httpPort = 8080;
const httpsPort = 8081;

const serveOptions = {
    servedir: "./",
    port: 8082,
};

const buildOptions = {
    entryPoints: {
        main: "src/index.ts",
    },
    define: {
        "NPM_PACKAGE_VERSION": `"${process.env.VERSION ?? process.env.npm_package_version}"`,
    },
    sourcemap: true,
    minify: false,
    bundle: true,
    splitting: true,
    platform: "browser",
    publicPath: "/dist",
    target: ["esnext"],
    format: "esm",
    external: [],
    outdir: "./dist",
    loader: {
        ".wasm": "file",
        ".bin": "file",
        ".png": "file",
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text",
        ".wgsl": "text",
    },
    plugins: [],
};

const ctx = await context(buildOptions);
const server = await ctx.serve(serveOptions);
const { port, host } = server;
const ipAddress = ip.address();
console.log(`http://localhost:${httpPort}/`);
console.log(`https://${ipAddress}:${httpsPort}/`);

// start a proxy servers for both http (localhost) and https (lan ip)
const httpsOptions = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.crt"),
};

http.createServer(handleReq).listen(httpPort, "127.0.0.1");
https.createServer(httpsOptions, handleReq).listen(httpsPort, ipAddress);

function handleReq(req, res) {
    const options = {
        hostname: host,
        port: port,
        path: req.url,
        method: req.method,
        headers: req.headers,
    };

    // forward each incoming request to esbuild
    const proxyReq = http.request(options, proxyRes => {
        let { headers } = proxyRes;
        // console.log(`${proxyRes.req.path}: ${proxyRes.statusCode}`);
        if (proxyRes.statusCode === 200) {
            // add headers for https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated so that we can use SharedArrayBuffer
            headers = {
                ...headers,
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
            };
        }

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
    });

    // forward the body of the request to esbuild
    req.pipe(proxyReq, { end: true });
};

await server.wait;
