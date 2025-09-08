/// <reference types="@webgpu/types" />

import { Triangle, Hexagon } from "./shape";

// import quadfragmentShaderCode from "./shaders/quad.frag.wgsl?raw";
import fixedvertexShaderCode from "./shaders/fixed.vert.wgsl?raw";


import depthFragmentShaderCode from "./shaders/depth.frag.wgsl?raw";

import { GUI } from 'dat.gui';
import Debugger from "./debug";
import Stats from 'stats.js'

import JSZip from 'jszip';
import QuadTree from './data'
import QuadManager from "./quadManager";
import Eval from "./eval";
import Render from "./render";
window.addEventListener('load', async function() {
	const stats = new Stats();
	stats.showPanel(0)
	document.body.appendChild(stats.dom);

	// const DEFAULT_COORD = [0.5, 0.6];
	// const DEFAULT_COORD = [0.51, 0.51];
	// const DEFAULT_COORD = [0.59, 0.69];
	const DEFAULT_COORD = [0.41, 0.35];
	// const DEFAULT_COORD = [1.0 - 0.35, 0.41];
	// const DEFAULT_COORD = [0.19, 0.14];
	// const DEFAULT_COORD = [0.11, 0.07];

	// import quadtestfragmentShaderCode from "./shaders/quad.test.frag.wgsl?raw";

	// Make list of all .png files in public/data/obs
	const response = await fetch('/data/obs/fileList.json');
	const files = (await response.json()).files
	const textureList = files.filter((file: string) => file.endsWith('.png'));
	const quadTreeList = files.filter((file: string) => file.endsWith('.json'));

	if (!navigator.gpu) {
		console.error("WebGPU is not supported in your browser.");
		throw new Error("WebGPU is not supported in your browser.");
	}


	// const canvas = document.createElement("canvas");
	const canvas = document.querySelector('canvas') as HTMLCanvasElement;
	if (!canvas) {
		console.error("Failed to get canvas element.");
		throw new Error("Failed to get canvas element.");
	}
	const adapter = await navigator.gpu?.requestAdapter();
	if (!adapter) throw new Error("No WebGPU adapter.");
	if (!adapter.features.has("timestamp-query")) {
		  throw new Error("This device/browser doesn't support timestamp-query.");
		  
	}
	const device = await adapter?.requestDevice({
		requiredFeatures: ["timestamp-query"],
	});
	if (!device) {
		throw new Error("Failed to get WebGPU device.");
	}
	
	// Query set
	// const sampleCount = 5
	// const querySet = device.createQuerySet({
		  // type: "timestamp",
		    // count: sampleCount
	// });
	// const queryBuffer = device.createBuffer({
		  // size: 8*sampleCount,
		  // usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
	// });
	// Read buffer from sample
	// const readSampleBuffer = device.createBuffer({
		  // size: 8*sampleCount,
		  // usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
	// });

	// debug manager
	const dbug_mngr = new Debugger(device);


	const context = canvas.getContext('webgpu') as GPUCanvasContext;


	const devicePixelRatio = window.devicePixelRatio || 1;
	canvas.width = canvas.clientWidth * devicePixelRatio;
	canvas.height = canvas.clientHeight * devicePixelRatio;


	const canvasOrigSize = {
		width: Math.min(canvas.width, canvas.height),
		height: Math.min(canvas.width, canvas.height)
		// width: Math.min(canvas.width, canvas.height)*2.0,
		// height: Math.min(canvas.width, canvas.height)*2.0
	}
	usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device,
		format: presentationFormat,
	});
	// Vertex Buffer
	const Vertices = new Float32Array([
		-1.0, 1.0,   // Vertex 1 (x, y)
		-1.0, -1.0, // Vertex 2 (x, y)
		1.0, -1.0,  // Vertex 3 (x, y)
		-1.0, 1.0,   // Vertex 1 (x, y)
		1.0, -1.0,  // Vertex 2 (x, y)
		1.0, 1.0    // Vertex 3 (x, y)
	])

	const vertexBuffer = device.createBuffer({
		size: Vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	});
	const mapping = new Float32Array(vertexBuffer.getMappedRange());
	mapping.set(Vertices);
	vertexBuffer.unmap();

	// Mipmap pipeline
	// load image
	// Load Textures
	const image = await loadImageBitmap(textureList[0]);

	// print byte size of image
	// Upload image data to texture level 0
	const imageBitmap = image;
	// const imageCanvas = document.createElement('canvas');
	const imageCanvas = document.createElement('canvas');
	const ctx = imageCanvas.getContext('2d');
	// imageCanvas.width = textureSize.width;
	// imageCanvas.height = textureSize.height;

	// Read 
	// ensure ctx is not null
	if (!ctx) {
		console.error("Failed to get 2d context.");
		throw new Error("Failed to get 2d context.");
	}

	ctx.drawImage(imageBitmap, 0, 0);
	// depth Sampler
	const depthSampler = device.createSampler({
		compare: undefined,
	});

	// console print file name
	const quadTreeData0 = await fetch(quadTreeList[0]);
	const quadTreeJsonString0 = await quadTreeData0.json();
	let quadTreeJson0 = JSON.parse(quadTreeJsonString0);
	console.log("Loading QuadTree from:", quadTreeList[1]);
	const quadTreeData1 = await fetch(quadTreeList[1]);
	const quadTreeJsonString1 = await quadTreeData1.json();
	let quadTreeJson1 = JSON.parse(quadTreeJsonString1);
	let quadTrees = [quadTreeJson1, quadTreeJson0];

	// let quadManager = new QuadManager(device, canvasOrigSize, mipLevel);
	let quadManager = new QuadManager(device, canvasOrigSize);
	quadManager.init(DEFAULT_COORD, quadTrees);

	const textureSize = quadManager.bufferMux.config.textureSize;


	let render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager.bufferMux);

	await device.queue.onSubmittedWorkDone();

	class Params {
		travelValues: number[];
		change: boolean = false;
		output: boolean = false;
		constructor(travelValues: number[]) {
			this.travelValues = travelValues;
		}
		updateTravelValues(travelValues: number[] = [this.travelValues[0], this.travelValues[1]]) {
			this.change = true;
			this.travelValues = [travelValues[0], travelValues[1]];
		}
	}


	let calls = 0;
	function updateTravBufferCoord(uv: number[], commandEncoder?: GPUCommandEncoder, travBuffer) {
		// const mipLevel = travBuffer.length; 

		const values = new Float32Array([uv[0], uv[1], 0, 1]);
		const stagingBuffer = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true
		});
		const arrayBuffer = stagingBuffer.getMappedRange();
		(new Float32Array(arrayBuffer)).set(values);
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, travBuffer, 0, values.byteLength);
		stagingBuffer.unmap();
	}


	async function updateUniformBuffer(values: number[]) {
		const floatArray = new Float32Array(values);
		device.queue.writeBuffer(quadManager.bufferMux.uniform, 0, floatArray);
		await device.queue.onSubmittedWorkDone();
	}


	// time intervall 10, 100, 1000 ms
	// const TIMEINTERVAL = [10, 100, 1000, 5000, 10000, 15000, 20000];
	// const TIMEINTERVAL = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 50000];
	// generate TIMEINTERVAL with 50 steps between 10 and 6000
	const TIMEINTERVAL = []; 
	for (let i = 0; i < 80; i++) {
		TIMEINTERVAL.push(Math.floor(10 + (6000 - 10) * (i / 49)));
	}
	let numSample = 5;
	let opTime = 0;

	var timeInterval = TIMEINTERVAL;
	const params = new Params(DEFAULT_COORD);
	const gui = new GUI();
	{
		// const folder = gui.addFolder("Mipmap");
		// folder.add({ value: mipLevel}, 'value', 0, mipLevel, 1).name("Mip Level").onChange(async (value: number) => {
		// const resolution = new Float32Array([canvasOrigSize.width, canvasOrigSize.height, value]);
		// await updateUniformBuffer(resolution);
		// });
		// folder.open();
		// Add folder for uv coordinates
		const uvFolder = gui.addFolder("UV Coordinates");
		uvFolder.add({ value: DEFAULT_COORD[0] }, 'value', 0, 1, 0.01).name("U").onChange(async (value: number) => {
			params.updateTravelValues([value, uvFolder.__controllers[1].object.value]);	
		})
		uvFolder.add({ value: DEFAULT_COORD[1] }, 'value', 0, 1, 0.01).name("V");
		uvFolder.open();
		// check box for output

		const debugFolder = gui.addFolder("Debug");
		debugFolder.add({ value: false }, 'value').name("Output to console").onChange((value: boolean) => {
			params.output = value;
			startTime = 0;
			if (value) {
				// reset timeInterval
				timeInterval = TIMEINTERVAL;
				params.output = value;
				params.updateTravelValues();
			}else{
				timeInterval = [];
				params.output = value;
				params.updateTravelValues();
			}
		})
		// switch between workgroup render and result dropdown
		debugFolder.add({ value: "result" }, 'value', ["result",  "result - lines", "traversal Workgroup", "vertex Workgroup"]).name("Mode").onChange((value: string) => {
			if (value === "traversal Workgroup") {
				const input = new Uint32Array([2, 0]);
				quadManager.bufferMux.updateInput(input);

			} else if (value === "result") {
				const input = new Uint32Array([0, 0]);
				quadManager.bufferMux.updateInput(input);

			} else if (value === "result - lines") {
				const input = new Uint32Array([1, 0]);
				quadManager.bufferMux.updateInput(input);
			} else if (value === "vertex Workgroup") {
				const input = new Uint32Array([3, 0]);
				quadManager.bufferMux.updateInput(input);
			}
		})

		// button that saves dbug_mngr.data to file
		debugFolder.add({ save: () => {
			dbug_mngr.saveToFile();
		}}, 'save').name("Save debug data to file");
		debugFolder.open();
	}

	// Main loop
	let frameCount = 0;
	let lastFrameTime = Date.now()

	const commandEncoderArg = device.createCommandEncoder();
	const commandBufferArg = commandEncoderArg.finish();
	await device.queue.submit([commandBufferArg]);
	await device.queue.onSubmittedWorkDone();


	let current_mipLevel = 0;
	var reference = true;


	// TODO change when retrying
	let startTime = 0; 
	let nameIndex = 1;

	async function frame() {
		if (startTime === 0) {
			await device.queue.onSubmittedWorkDone();
			// wait 1 second before starting the timer
			await new Promise(resolve => setTimeout(resolve, 1000));
			startTime = Date.now() - opTime;;
		}
		stats.begin();
		const currentTime = Date.now() - opTime;
		// const commandEncoder = device.createCommandEncoder();
		const commandEncoder = device.createCommandEncoder({
			timestampWrites: {
				querySet: dbug_mngr.querySet,
				beginningOfPassWriteIndex: 0,
				endOfPassWriteIndex: dbug_mngr.sampleCount - 1,
			},
		});
		// commandEncoder.writeTimestamp(querySet, 0);
		dbug_mngr.addTimestamp(commandEncoder)
		// Update the stats panel
		if (params.change) {
			frameCount = 0;
			current_mipLevel = 0;
			params.change = false;
			reference = true

			await quadManager.unmap();
			// quadManager = new QuadManager(device, textureSize, mipLevel, params.travelValues);
			quadManager = new QuadManager(device, textureSize, params.travelValues);
			quadManager.init(params.travelValues, quadTrees);
			render = new Render(device, context, canvas, presentationFormat, depthSampler, quadManager.bufferMux);
			const commandEncoderArg = device.createCommandEncoder();
			updateTravBufferCoord(params.travelValues, commandEncoderArg, quadManager.bufferMux.traversal);
			const commandBufferArg = commandEncoderArg.finish();
			// await device.queue.submit([commandBufferArg]);
			// await device.queue.onSubmittedWorkDone();
			requestAnimationFrame(frame);
			// clear browser console
			return;
			// }else if(16*2 > frameCount){
		}
		current_mipLevel++;
		await quadManager.eval.pass(frameCount, commandEncoder);
		// commandEncoder.writeTimestamp(querySet, 1)
		dbug_mngr.addTimestamp(commandEncoder)
		quadManager.genVertex.pass(frameCount, commandEncoder);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.result, 0, 32);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.traversal, 0, 32);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.traversal, 32, 32);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.features[0], 0, 32);
		// mesure time 
		// await quadManager.quadTree.pass(frameCount / 2, commandEncoder);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.evalThreadIter, 0, 32);
		// await dbug_mngr.fromBufferToLog(quadManager.bufferMux.result, 0, 32);
		// await dbug_mngr.u32fromBufferToLog(quadManager.bufferMux.uniform, 0, 32);
		// commandEncoder.writeTimestamp(querySet, 2);
		dbug_mngr.addTimestamp(commandEncoder)
		// resolve query TODO check such deltaNs not zero
		// commandEncoder.resolveQuerySet(querySet, 0, 2, queryBuffer, 0);
		// commandEncoder.copyBufferToBuffer(queryBuffer, 0, readSampleBuffer, 0, 8*sampleCount);
		dbug_mngr.end(commandEncoder)
		
		device.queue.submit([commandEncoder.finish()]);
		dbug_mngr.saveSample(commandEncoder)
		// await device.queue.onSubmittedWorkDone();	
		// await readSampleBuffer.mapAsync(GPUMapMode.READ);
		// const timestamps = new BigUint64Array(readSampleBuffer.getMappedRange());
		// const deltaNs = Number(timestamps[1] - timestamps[0]);

		// console.log("GPU time (ns):", deltaNs);
		// console.log("GPU time (ms):", deltaNs / 1e6);
		// readSampleBuffer.unmap();
		// renderpass locked 30 fps
		if (currentTime - lastFrameTime > 1000 / 30) {
			const renderCommandEncoder = device.createCommandEncoder();
			// for (let i = 0; i < 1; i++) {
				// quadManager.genVertex.pass(i, renderCommandEncoder);
			// }
			render.pass(frameCount, renderCommandEncoder)
			device.queue.submit([renderCommandEncoder.finish()]);
			lastFrameTime = currentTime;
			let data = await quadManager.bufferMux.getTextureData();
			// console.log(data)
		}
		frameCount++;
		stats.end();
		if (timeInterval.length > 0 && params.output && currentTime - startTime >= timeInterval[0] ) {
			const opBeforeTime = Date.now();
			// for (let i = 0; i < 10; i++) {
			// 	current_mipLevel++;
			// 	const waitCommandEncoder = device.createCommandEncoder();
			// 	quadManager.genVertex.pass(1, waitCommandEncoder);
			// 	// quadManager.genVertex.pass(current_mipLevel, waitCommandEncoder);
			// 	device.queue.submit([waitCommandEncoder.finish()]);
			// }

			await device.queue.onSubmittedWorkDone();
			// opTime += Date.now() - opBeforeTime;
			// await for queue to finish
			const renderCommandEncoder = device.createCommandEncoder();
			render.pass(frameCount, renderCommandEncoder)
			device.queue.submit([renderCommandEncoder.finish()]);
			lastFrameTime = currentTime;
			await device.queue.onSubmittedWorkDone();



			// save and download canvas
			const interval = timeInterval[0];
			const link = document.createElement('a');

			link.download = `snapshot_${nameIndex}_${interval}.png`;
			nameIndex++;
			link.href = canvas.toDataURL('image/png');
			// link text/value
			link.textContent = `Download snapshot ${nameIndex} (${interval} ms) (actual time: ${currentTime - startTime} ms)`;
			// hide all other links
			const links = linksContainer.querySelectorAll('a');
			if (links.length === 0) {
				link.textContent = `Download snapshot ${nameIndex} (${interval} ms) (actual time: ${currentTime - startTime} ms) (first)`;
			}else{
				for (const l of links) {
					l.style.display = 'none';
				}
			}
			link.style.display = 'visible'

			// link.click();
			linksContainer.appendChild(link);

			// make link visible
			// linksContainer.style.display = 'flex';
			link.style.display = 'block'
			// remove timeInterval[0]
			timeInterval.shift();
			// params.updateTravelValues()
			// startTime = 0;
			if (timeInterval.length === 0) {
				// package all links in a zip file
				const zip = new JSZip();
				const links = linksContainer.querySelectorAll('a');
				// make directory snapshot_{numSample}
				const dir = zip.folder(`snapshots_${numSample}`);
				for (const link of links) {
					const response = await fetch(link.href);
					const blob = await response.blob();
					// add to zip file in the directory
					dir?.file(link.download, blob);
					// zip.file(link.download, blob);
				}
				numSample--;
				
				// create zip file
				const content = await zip.generateAsync({ type: 'blob' });
				const zipLink = document.createElement('a');
				zipLink.download = `snapshots.zip`;
				zipLink.href = URL.createObjectURL(content);
				zipLink.textContent = `Download all snapshots`;
				zipLink.style.display = 'block';
				linksContainer.appendChild(zipLink);
				dbug_mngr.saveToFile();
			}
			current_mipLevel = 0;
		}

		requestAnimationFrame(frame);
	}

	function resizeCanvas() {
		const newWidth = Math.floor(canvas.clientWidth / devicePixelRatio);
		const newHeight = Math.floor(canvas.clientHeight / devicePixelRatio);

		if (canvas.width !== newWidth || canvas.height !== newHeight) {
			canvas.width = newWidth;
			canvas.height = newHeight;
			console.log(`Resized canvas to ${canvas.width}x${canvas.height}`);
			context.configure({ device, format: presentationFormat  });
		}

	}

	window.addEventListener("resize", resizeCanvas, { passive: true  });
	resizeCanvas(); // Ensure correct size on startup



	async function loadImageBitmap(url: string) {
		const response = await fetch(url);
		const blob = await response.blob();
		return createImageBitmap(blob);

	}
	// listen and find uv coordinates of mouse on click
	canvas.addEventListener('click', async (event) => {
		frameCount = 0;
		console.clear();
		let rect = canvas.getBoundingClientRect();
		const x = (event.clientX - rect.left);
		const y = (event.clientY - rect.top);
		// const pixRat = {
		// 	x: canvas.width / HEIGHT * devicePixelRatio,
		// 	y: canvas.height / WIDTH * devicePixelRatio 
		// }
		const uv = [x / canvas.width, y / canvas.height];
		// gui.__folders["Mipmap"].__controllers[0].setValue(mipLevel);
		gui.__folders["UV Coordinates"].__controllers[0].setValue(uv[0]);
		gui.__folders["UV Coordinates"].__controllers[1].setValue(uv[1]);
		params.updateTravelValues([uv[0], uv[1]]);
		// await updateTravBufferCoord(uv);
		// requestAnimationFrame(frame);
	}, { passive: true  })

	window.addEventListener('beforeunload', async () => {
		await device.queue.onSubmittedWorkDone();
		quadManager.unmap();
	}, { passive: true  })


	// on load, start the frame loop 
	console.log("Window loaded, starting frame loop...");
	requestAnimationFrame(frame);
});
