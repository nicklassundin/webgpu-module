
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
	let textDim = textureDimensions(texture);
	let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	let quadCoord = pixCoord % 2u;
	let quad = quadCoord.x + quadCoord.y * 2u;
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

fn getNodeIndex(level: u32, pos: u32) -> u32 {
	
	return u32((pow(4, f32(level))) / 3 + f32(pos));
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

fn newCoordQuad(coord: vec2<f32>, tQuad: u32) -> vec2<f32> {		
	let textDim = textureDimensions(texture);
	var pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));
	pixCoord.x = pixCoord.x / 2u * 2u;
	pixCoord.y = pixCoord.y / 2u * 2u;
	for (var x = 0u; x < 2u; x = x + 1u) {
		for (var y = 0u; y < 2u; y = y + 1u) {
			if (quadFromeCoord(vec2<f32>(f32(x), f32(y)), vec4<f32>(0.0, 0.0, 1.0, 1.0)) == tQuad) {
				pixCoord.x = pixCoord.x + x;
				pixCoord.y = pixCoord.y + y;
				let newCoord = vec2<f32>(f32(pixCoord.x) / f32(textDim.x), f32(pixCoord.y) / f32(textDim.y));
				return newCoord;
			}
		}
	}
	return vec2<f32>(coord);
}

// check quadMap level of all is done
fn checkQuadMapLevelDone(index: u32) -> bool {
	for (var i = 0u; i < 4u; i = i + 1u) {
		let nodeIndex = getNodeIndex(index, i);
		if (quadMap[nodeIndex] == 0u) {
			return false;
		}
	}
	return true;
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
		var coord = traversal[index].coord;
		let boundBox = traversal[index].boundBox;
		// Check if path is done
		var quad = quadFromeCoord(coord, boundBox);
		let nodeIndex = getNodeIndex(index, quad);


		let trav = traversal[index];
		threadIterations.iterations[threadIndex] = iter + 1u;
		let node = getNode(u32(trav.address));
		let value = getValue(node) / values[0];

		let texCoord = vec2<u32>(vec2<f32>(texDim) * vec2<f32>(coord.x, coord.y));
		let color = vec4<f32>(value, 0.0, 0.0, 1.0);
		textureStore(texture, texCoord, color); 
		
		// What is next node	
		if (checkQuadMapLevelDone(index)) {
			// TODO doesn't enter here
			quadMap[nodeIndex] = 1u;
			threadIterations.iterations[threadIndex] = iter + iter / 16u;
			return;
		}
		let nextBoundBox = boundBoxFromeCoord(quad, boundBox);
		let nextQuad = quadFromeCoord(coord, nextBoundBox);
		let children = node.children;
		let child = children[nextQuad];
		let childNodeIndex = getNodeIndex(index+1u, nextQuad);
	
		/*
		result[threadIndex][index] = f32(quadMap[nodeIndex]);
		result[threadIndex][index] = f32(child);
		result[threadIndex][index] = value;
		*/

		if (child < 0.0) {
			quadMap[childNodeIndex] = 1u;
			threadIterations.iterations[threadIndex] = iter + iter / 16u;
			let newQuad = (quad + 1u) % 4u;
			let newCoord = newCoordQuad(coord, newQuad);
			traversal[0u].coord = newCoord;
			return;
		}
		traversal[index+1u].done = 1;
		traversal[index+1u].address = child;
		traversal[index+1u].coord = coord;
		
	}
