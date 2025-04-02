
async function fromBufferToLog(device: GPUDevice, storageBuffer: GPUbuffer,  offset: number = 0, size: number = storageBuffer.size) {
	// Create a readback buffer
	const readBuffer = device.createBuffer({
		size: size*Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});
	const commandEncoder = device.createCommandEncoder();
	commandEncoder.copyBufferToBuffer(storageBuffer,
					  offset,
					  // 0,
					  readBuffer, 
					  0, 
					  size);
	const commands = commandEncoder.finish();
	device.queue.submit([commands]);
	await device.queue.onSubmittedWorkDone();

	// Map the readback buffer and read the integer
	await readBuffer.mapAsync(GPUMapMode.READ);
	const arrayBuffer = readBuffer.getMappedRange();
	const view = new Float32Array(arrayBuffer);

	console.log('view', view);
	readBuffer.unmap();
}
async function u32fromBufferToLog(device: GPUDevice, storageBuffer: GPUBuffer, offset: number = 0, size: number = storageBuffer.size) {
	// Create a readback buffer
	const readBuffer = device.createBuffer({
		size: size*Uint32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});
	const commandEncoder = device.createCommandEncoder();
	commandEncoder.copyBufferToBuffer(storageBuffer,
					  offset,
					  // 0,
					  readBuffer, 
					  0, 
					  size);
	const commands = commandEncoder.finish();
	device.queue.submit([commands]);
	await device.queue.onSubmittedWorkDone();

	// Map the readback buffer and read the integer
	await readBuffer.mapAsync(GPUMapMode.READ);
	const arrayBuffer = readBuffer.getMappedRange();
	const view = new Uint32Array(arrayBuffer);

	console.log('view', view);
	readBuffer.unmap();
}

class Debugger {
	constructor(device: GPUDevice) {
		this.device = device;
	}
	async fromBufferToLog(storageBuffer: GPUBuffer, offset: number = 0, size: number) {
		await fromBufferToLog(this.device, storageBuffer, offset, size);
	}
	async u32fromBufferToLog(storageBuffer: GPUBuffer, offset: number = 0, size: number) {
		await u32fromBufferToLog(this.device, storageBuffer, offset, size);
	}
}


export default Debugger; 
