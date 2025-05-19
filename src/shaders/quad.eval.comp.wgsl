
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
depth: f32,
	       address: f32,
	       coord: vec2<f32>,
	       boundBox: vec4<f32>,
	       quad: i32,
	       done: i32,
	       _pad: vec2<f32>,
};

struct ThreadInfo {
reference: array<f32, 16>,
		   iterations: array<u32>,
};
@group(1) @binding(1) var<storage, read_write> threadIterations: ThreadInfo; 

// TEST
fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 6u],
			vec4<f32>(nodes[index * 6u + 1u], nodes[index * 6u + 2u], nodes[index * 6u + 3u], nodes[index * 6u + 4u]),
			nodes[index * 6u + 5u]
			);
	return node;
}


// END TEST

fn quadFromeCoord(uv: vec2<f32>, boundBox: vec4<f32>) -> u32 {
	var coord = uv;
	// normalize in boundBox
	coord.x = (coord.x - boundBox.x) / (boundBox.z - boundBox.x);
	coord.y = (coord.y - boundBox.y) / (boundBox.w - boundBox.y);
	// convert to 0 or 1
	coord.x = step(0.5, coord.x);
	coord.y = step(0.5, coord.y);
	// quad
	let quad = u32(coord.x + coord.y * 2.0);
	return u32(quad);
}


fn boundBoxFromeCoord(quad: u32, boundBox: vec4<f32>) -> vec4<f32> {
	// new boundbox
	var nBoundBox = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	let center = (boundBox.xy + boundBox.zw) * 0.5;
	if (quad == 0u){
		nBoundBox = vec4<f32>(boundBox.x, boundBox.y, center.x, center.y);
	} else if (quad == 1u){
		nBoundBox = vec4<f32>(center.x, boundBox.y, boundBox.z, center.y);
	} else if (quad == 2u){
		nBoundBox = vec4<f32>(boundBox.x, center.y, center.x, boundBox.w);
	} else if (quad == 3u){
		nBoundBox = vec4<f32>(center.x, center.y, boundBox.z, boundBox.w);
	}
	return nBoundBox;
}

fn getNodeIndex(level: f32, pos: f32) -> u32 {
	return u32((pow(4, level)) / 3 + pos);
}

fn travers(threadIndex: u32, iter: u32){
	let id: u32 = iter % 15u;
	let trav = traversal[id];

	var pTrav = traversal[id-1];
	let quad = trav.quad;

	let node = getNode(u32(pTrav.address));
	var child = node.children[quad];

	if(child < 0.0 || ((pTrav.address == 0.0) && (id > 1u))) {
		levelValues[threadIndex][id] = 0.0;
		return;
	}
	levelValues[threadIndex][id] = values[u32(child)] / values[0];

	traversal[id].address = child;
	traversal[id].done = 0i;
}
fn getValue(node: Node) -> f32 {
	return values[u32(node.valueAddress)];
}

@group(0) @binding(0) var<storage, read_write> result: array<array<f32, 16>>;
@group(0) @binding(1) var<storage, read_write> traversal: array<Traversal>; 
@group(0) @binding(2) var<storage, read_write> quadMap: array<u32>;
@group(0) @binding(3) var texture: texture_storage_2d<rgba8unorm, write>;
//@group(1) @binding(0) var<storage, read> levelValues: array<array<f32, 16>>;
@group(1) @binding(0) var<storage, read_write> levelValues: array<array<f32, 16>>;

@group(1) @binding(2) var<storage, read_write> values: array<f32>;
@group(1) @binding(3) var<storage, read_write> nodes: array<f32>;


@compute @workgroup_size(1)
	fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
			@builtin(local_invocation_id) local_id: vec3<u32>) {
		let texDim = textureDimensions(texture);
		let threadIndex = local_id.x;
		let iter = threadIterations.iterations[threadIndex];
		
		let index: u32 = (iter) % 16u; 
		
		let trav = traversal[index];
		if (trav.done == 0 && index != 0u) {
			return;
		}
		let node = getNode(u32(trav.address));
		
		var coord = traversal[index].coord;

		let value = getValue(node) / values[0];
		let texCoord = vec2<u32>(vec2<f32>(texDim) * vec2<f32>(coord.x, coord.y));
		let color = vec4<f32>(value, 0.0, 0.0, 1.0);
		textureStore(texture, texCoord, color); 
		result[threadIndex][index] = value;
		
		let boundBox = traversal[index].boundBox;
		var quad = quadFromeCoord(coord, boundBox);
		
		let nextBoundBox = boundBoxFromeCoord(quad, boundBox);
		let nextQuad = quadFromeCoord(coord, nextBoundBox);
		let children = node.children;
		let child = children[nextQuad];
		if (child < 0.0) {
			traversal[index+1u].done = 0;
			return;
		}
		traversal[index+1u].done = 1;
		traversal[index+1u].address = child;
		traversal[index+1u].coord = coord;
		threadIterations.iterations[threadIndex] = iter + 1u;
	}
