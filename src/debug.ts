
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
	const string = 	`[${view.join(', ')}]`
	console.log(string)
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
	sampleIndex: number = 0;
	data: number[] = [];
	sampleCount: number = 5;
	constructor(device: GPUDevice) {
		this.device = device;
		this.querySet = device.createQuerySet({
			type: 'timestamp',
			count: this.sampleCount,
		});
		this.queryBuffer = device.createBuffer({
			size: 8*this.sampleCount,
			usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
		});
		this.readSampleBuffer = device.createBuffer({
			size: 8*this.sampleCount,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		})
	}
	async fromBufferToLog(storageBuffer: GPUBuffer, offset: number = 0, size: number) {
		await fromBufferToLog(this.device, storageBuffer, offset, size);
	}
	async u32fromBufferToLog(storageBuffer: GPUBuffer, offset: number = 0, size: number) {
		await u32fromBufferToLog(this.device, storageBuffer, offset, size);
	}
	addTimestamp(enc: GPUCommandEncoder, index: number = this.sampleIndex) {
		enc.writeTimestamp(this.querySet, index);	
		if (index == this.sampleIndex){
			this.sampleIndex++;
		}
	}
	end(enc: GPUCommandEncoder) {
		for (let i = 0; i < this.sampleCount; i++){
			enc.resolveQuerySet(this.querySet, 0, i, this.queryBuffer, 0);
			enc.copyBufferToBuffer(this.queryBuffer, 0, this.readSampleBuffer, 0, 8*this.sampleCount);
		}
	}
	async saveSample(enc: GPUCommandEncoder) {
		await this.readSampleBuffer.mapAsync(GPUMapMode.READ);
		const timestamps = new BigUint64Array(this.readSampleBuffer.getMappedRange());
		// convert to array
		const ts = Array.from(timestamps);
		this.data.push(...ts)
		for (let i = 1; i < ts.length; i++){
			// console.log(this.data)
			// console.log('time:', Number(ts[i]))
		}
		this.readSampleBuffer.unmap();
		this.sampleIndex = 0;
	}
	reset() {
		this.sampleIndex = 0;
		this.data = [];
	}
	// Save this.data to file
	saveToFile() {
		let result = this.data
		// filter out 0
		result = result.filter((v) => v != BigInt(0))
		// console.log('result', result);
		const blob = new Blob([result.join('\n')], {type: 'text/plain'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'debug.txt';
		a.click();
		URL.revokeObjectURL(url);
	}
}



export default Debugger; 
