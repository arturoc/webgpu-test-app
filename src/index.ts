import { RenderContextWebGPU, downloadCore3dImports, type RenderState, defaultRenderState, type RenderStatistics } from "@novorender/core3d"
import { esbuildImportMap } from "./esbuild";
import { getDeviceProfile, type GPUTier, View, type ViewStatistics } from "@novorender/web_app";

export async function run() {
    const gpuTier: GPUTier = 2;
    const deviceProfile = getDeviceProfile(gpuTier);
    const map = esbuildImportMap(new URL("dist", import.meta.url));
    const imports = await downloadCore3dImports(map);
    const canvas = document.getElementById("output") as HTMLCanvasElement;
    // TODO: webgpu equivalent or even read from the webgl attributes?
    // const options: WebGLContextAttributes = {
    //     alpha: true,
    //     antialias: true,
    //     depth: false,
    //     desynchronized: false,
    //     failIfMajorPerformanceCaveat: true,
    //     powerPreference: "high-performance",
    //     premultipliedAlpha: true,
    //     preserveDrawingBuffer: true,
    //     stencil: false,
    // };
    const renderContext = new RenderContextWebGPU(deviceProfile, canvas, imports);
    await renderContext.init();
    let prevState: RenderState | undefined;
    let renderStateGL: RenderState = defaultRenderState();
    let statistics: { readonly render: RenderStatistics, readonly view: ViewStatistics } | undefined = undefined;
    const resolutionModifier = 1;
    const currentDetailBias = 1;
    let prevRenderTime = performance.now();


    document.getElementById("loseContext")?.addEventListener("click", () => {
        console.log("pressed lose context");
        renderContext.emulateLostContext("lose");
        // return true;
    });

    while (true) {
        const renderTime = await RenderContextWebGPU.nextFrame(renderContext);
        const frameTime = renderTime - prevRenderTime;
        if(renderContext && !renderContext.isContextLost()) {
            renderContext.poll();


            if (prevState !== renderStateGL || renderContext.changed) {
                prevState = renderStateGL;
                const statsPromise = renderContext.render(renderStateGL);
                statsPromise.then((stats) => {
                    statistics = {
                        render: stats,
                        view: {
                            resolution: resolutionModifier,
                            detailBias: deviceProfile.detailBias * currentDetailBias,
                            fps: stats.frameInterval ? 1000 / stats.frameInterval : undefined
                        }
                    };
                });
            }
        }else{
            prevState = undefined;
        }
    }
}

run()