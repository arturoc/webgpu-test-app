import type { ViewImportmap } from "@novorender/web_app";
import { shaders, shadersWGSL } from "@novorender/core3d/shaders"; // inline
import wasmUrl from "@novorender/core3d/wasm/main.wasm"; // file loader
//@ts-ignore
import wasmParserUrl from "@novorender/wasm-parser/wasm_parser_bg.wasm"; // file loader
import lutGGXUrl from "@novorender/core3d/lut_ggx.png"; // file loader
import logoUrl from "@novorender/core3d/modules/watermark/logo.bin"; // file loader
import nurbsWasmUrl from "@novorender/measure/wasm/nurbs.wasm"; // file loader
const loaderWorkerUrl = "./loaderWorker.js";
const measureWorkerUrl = "./measureWorker.js";
const ioWorkerUrl = "./io.js";

/** @internal */
export function esbuildImportMap(baseUrl: URL): ViewImportmap {
    const map: ViewImportmap = {
        baseUrl,
        loaderWorker: loaderWorkerUrl,
        lutGGX: lutGGXUrl,
        wasmInstance: wasmUrl,
        parserWasm: wasmParserUrl as unknown as string,
        logo: logoUrl,
        shaders,
        shadersWGSL,
        measureWorker: measureWorkerUrl,
        nurbsWasm: nurbsWasmUrl,
        ioWorker: ioWorkerUrl,
    };
    return map;
}