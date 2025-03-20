
async function fromBufferToLog(device: GPUDevice, storageBuffer: GPUbuffer,  offset: number = 0, size: number = 4) {
	// Create a readback buffer
	const readBuffer = device.createBuffer({
		size: size*Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
	});
	const commandEncoder = device.createCommandEncoder();
	commandEncoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, size*Float32Array.BYTES_PER_ELEMENT);
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

class Debugger {
	constructor(device: GPUDevice) {
		this.device = device;
	}
	async fromBufferToLog(storageBuffer: GPUBuffer, offset: number = 0, size: number = 4) {
		await fromBufferToLog(this.device, storageBuffer, offset, size);
	}
}


export default Debugger; 
