class QuadTree {
	constructor(device: GPUDevice, json: Array){
		this.device = device;
		const values = new Float32Array(json.values);
		const valuesBuffer = device.createBuffer({
			size: values.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(valuesBuffer, 0, values.buffer);

		const nodes = new Float32Array(json.nodes);
		const nodesBuffer = device.createBuffer({
			size: nodes.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});
		device.queue.writeBuffer(nodesBuffer, 0, nodes.buffer);
		this.buffers = {
			nodes: nodesBuffer,
			values: valuesBuffer,
		}
	}
}

export default QuadTree;
