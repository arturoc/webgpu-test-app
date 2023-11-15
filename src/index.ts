import { RenderContextWebGPU, downloadCore3dImports, type RenderState, defaultRenderState, type RenderStatistics, type PickOptions, type PickSample, mergeRecursive, modifyRenderState, defaultRenderStateWebGPU } from "@novorender/core3d"
import { esbuildImportMap } from "./esbuild";
import { ControllerInput, FlightController, getDeviceProfile, type GPUTier, type ViewStatistics } from "@novorender/web_app";
import { flipState } from "@novorender/web_app/flip";

class PickContext {
    async pick(x: number, y: number, options?: PickOptions) : Promise<PickSample | undefined> {
        return undefined
    }
}

export async function run() {
    const gpuTier: GPUTier = 2;
    const deviceProfile = getDeviceProfile(gpuTier);
    const map = esbuildImportMap(new URL("dist", import.meta.url));
    const imports = await downloadCore3dImports(map);
    const canvas = document.getElementById("output") as HTMLCanvasElement;
    const config: Partial<GPUCanvasConfiguration> = {
        alphaMode: "opaque",
        colorSpace: "srgb",
    };
    const renderContext = new RenderContextWebGPU(deviceProfile, canvas, imports, config);
    await renderContext.init();
    let prevState: RenderState | undefined;
    const {  output, camera, quality, debug, grid, cube, scene, terrain,  dynamic, clipping, highlights, outlines, tonemapping, points, toonOutline, pick } = defaultRenderStateWebGPU();
    let renderStateGL: RenderState = {
        background: {
            // color: [1., 0., 0.4, 1.],
            url: "http://localhost:8080",
            // blur: 0.05,
        },
        grid: {
            enabled: true,
            axisX: grid.axisX,
            axisY: grid.axisY,
            color1: grid.color1,
            color2: grid.color2,
            distance: grid.distance,
            size1: grid.size1,
            size2: grid.size2,
            origin: grid.origin,
        },
        output: {
            width: document.body.clientWidth,
            height: document.body.clientHeight,
            samplesMSAA: 4,
            webgpu: output.webgpu,
        },
        camera, quality, debug, cube, scene, terrain,  dynamic, clipping, highlights, outlines,
        tonemapping, points, toonOutline, pick
    };
    let statistics: { readonly render: RenderStatistics, readonly view: ViewStatistics } | undefined = undefined;
    const resolutionModifier = 1;
    const currentDetailBias = 1;
    let prevRenderTime = performance.now();


    document.getElementById("loseContext")?.addEventListener("click", () => {
        console.log("pressed lose context");
        renderContext.emulateLostContext("lose");
        // return true;
    });

    const controllerInput = new ControllerInput();
    const pickContext = new PickContext();
    const activeController = new FlightController(controllerInput, pickContext);
    activeController.attach();
    let renderStateCad = structuredClone(renderStateGL);
    let prevRenderStateCad = undefined;
    flipState(renderStateCad, "GLToCAD");
    let stateChanges = undefined

    while (true) {
        const renderTime = await RenderContextWebGPU.nextFrame(renderContext);
        const frameTime = renderTime - prevRenderTime;
        const cameraChanges = activeController.renderStateChanges(renderStateCad.camera, renderTime - prevRenderTime);
        if (cameraChanges) {
            stateChanges = mergeRecursive(stateChanges, cameraChanges);
        }
        if(renderContext && !renderContext.isContextLost()) {
            renderContext.poll();

            // renderStateGL = modifyRenderState(renderStateGL, {
            //     output: {
            //         width: document.body.clientWidth,
            //         height: document.body.clientHeight,
            //         samplesMSAA: 4,
            //     }
            // })

            if (prevState !== renderStateGL || renderContext.changed) {
                prevState = renderStateGL;
                const statsPromise = renderContext.render(renderStateGL);
                await statsPromise.then((stats) => {
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


        if (stateChanges) {
            prevRenderStateCad = renderStateCad;
            renderStateCad = mergeRecursive(renderStateCad, stateChanges) as RenderState;
            // drawContext2d.camera = renderStateCad.camera;
            flipState(stateChanges, "CADToGL");
            renderStateGL = modifyRenderState(renderStateGL, stateChanges);
            // validate?.(renderStateGL, stateChanges);
            stateChanges = undefined;
        }

    }
}

run()