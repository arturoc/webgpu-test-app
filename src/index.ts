import { RenderContextWebGPU, downloadCore3dImports, type RenderState, defaultRenderState, type RenderStatistics, type PickOptions, type PickSample, mergeRecursive, modifyRenderState, defaultRenderStateWebGPU, RenderContext, TonemappingMode } from "@novorender/core3d"
import { esbuildImportMap } from "./esbuild";
import { ControllerInput, FlightController, getDeviceProfile, type GPUTier, type ViewStatistics } from "@novorender/web_app";
import { flipState } from "@novorender/web_app/flip";
// import { mat3, mat4, quat, vec3 } from "gl-matrix"

class PickContext {
    async pick(x: number, y: number, options?: PickOptions) : Promise<PickSample | undefined> {
        return undefined
    }
}

enum Mode {
    WebGPU,
    WebGL,
}


function _defaultRenderState(mode: Mode) {
    if(mode == Mode.WebGPU) {
        return defaultRenderStateWebGPU();
    }else{
        return defaultRenderState();
    }
}

export async function run(mode: Mode) {
    const gpuTier: GPUTier = 2;
    // TODO: port to webgpu
    const deviceProfile = getDeviceProfile(gpuTier);
    const map = esbuildImportMap(new URL("dist", import.meta.url));
    const imports = await downloadCore3dImports(map);
    const canvas = document.getElementById(mode == Mode.WebGPU ? "webgpu-output" : "webgl-output") as HTMLCanvasElement;
    let renderContext: RenderContext | RenderContextWebGPU;
    if(mode == Mode.WebGPU) {
        const config: Partial<GPUCanvasConfiguration> = {
            alphaMode: "premultiplied",
            colorSpace: "srgb",
        };
        renderContext = new RenderContextWebGPU(deviceProfile, canvas, imports, config);
    }else{
        const options: WebGLContextAttributes = {
            alpha: true,
            antialias: true,
            depth: false,
            desynchronized: false,
            failIfMajorPerformanceCaveat: true,
            powerPreference: "high-performance",
            premultipliedAlpha: true,
            preserveDrawingBuffer: true,
            stencil: false,
        };
        canvas.addEventListener("webglcontextlost", function (event: WebGLContextEvent) {
            event.preventDefault();
            console.info("WebGL Context lost!");
            if (renderContext) {
                renderContext.contextLost();
                // renderContext = undefined;
            }
            // trigger a reset of canvas on safari.
            canvas.width = 300;
            canvas.height = 150;
            // if (animId !== undefined)
            //     cancelAnimationFrame(animId);
            // animId = undefined;
        } as (event: Event) => void, false);

        canvas.addEventListener("webglcontextrestored", function (event: WebGLContextEvent) {
            console.info("WebGL Context restored!");
            renderContext = new RenderContext(deviceProfile, canvas, imports, options);
            renderContext.init();
        } as (event: Event) => void, false);
        renderContext = new RenderContext(deviceProfile, canvas, imports, options);
    }
    await renderContext.init();
    let prevState: RenderState | undefined;
    const {  output, camera, quality, debug, grid, cube, scene, terrain,  dynamic, clipping, highlights, outlines, tonemapping, points, toonOutline, pick } = _defaultRenderState(mode);
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
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            samplesMSAA: 4,
            // samplesMSAA: output.samplesMSAA,
            webgpu: output.webgpu,
        },
        cube: {
            enabled: true,
            position: cube.position,
            scale: cube.scale,
            drawAxis: false,
            drawCube: true,
        },
        outlines: {
            enabled: false,
            color: [0., 0., 0.],
            on: true,
            plane: [0., 0., 1., 0.],
        },
        clipping: {
            draw: false,
            enabled: false,
            planes: [
                {
                    normalOffset: [0., 0., 1., 0.],
                },
            ],
            mode: 0
        },
        // camera: {
        //     far: camera.far,
        //     fov: camera.fov,
        //     near: camera.near,
        //     pivot: camera.pivot,
        //     position: vec3.fromValues(1., 5., -6.),
        //     rotation,
        //     kind: "pinhole"
        // },
        camera,
        quality,
        debug,
        scene,
        terrain,
        dynamic,
        highlights,
        tonemapping: {
            exposure: tonemapping.exposure,
            mode: TonemappingMode.color
        },
        points,
        toonOutline,
        pick
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
        let renderTime;
        if(renderContext instanceof RenderContextWebGPU){
            renderTime = await RenderContextWebGPU.nextFrame(renderContext);
        }else{
            renderTime = await RenderContext.nextFrame(renderContext);
        }
        const frameTime = renderTime - prevRenderTime;
        const cameraChanges = activeController.renderStateChanges(renderStateCad.camera, renderTime - prevRenderTime);
        if (cameraChanges) {
            stateChanges = mergeRecursive(stateChanges, cameraChanges);
        }
        if(renderContext && !renderContext.isContextLost()) {
            renderContext.poll();

            if(canvas.clientWidth != renderStateGL.output.width || canvas.clientHeight != renderStateGL.output.height) {
                renderStateGL = modifyRenderState(renderStateGL, {
                    output: {
                        width: canvas.clientWidth,
                        height: canvas.clientHeight,
                        samplesMSAA: 4,
                    }
                })
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

            if (prevState !== renderStateGL || renderContext.changed) {
                prevState = renderStateGL;
                const statsPromise = renderContext.render(renderStateGL);
                const statsViewPromise = statsPromise.then((stats) => {
                    statistics = {
                        render: stats,
                        view: {
                            resolution: resolutionModifier,
                            detailBias: deviceProfile.detailBias * currentDetailBias,
                            fps: stats.frameInterval ? 1000 / stats.frameInterval : undefined
                        }
                    };
                });
                if(mode == Mode.WebGPU) {
                    await statsViewPromise;
                }
            }
        }else{
            prevState = undefined;
        }

    }
}

run(Mode.WebGPU)
run(Mode.WebGL)