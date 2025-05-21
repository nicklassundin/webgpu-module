
struct Node {
	valueAddress: f32,
	children: vec4<f32>,	
	quad: f32,
};

struct Traversal {
	       depth: f32,
	       address: f32,
	       coord: vec2<f32>,
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

fn quadFromeCoord(uv: vec2<f32>, textDim: vec2<u32>) -> u32 {
	let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	let quadCoord = pixCoord % 2u;
	let quad = quadCoord.x + quadCoord.y * 2u;
	return u32(quad);
}


fn getNodeIndex(level: u32, pos: u32) -> u32 {
	
	return u32((pow(4, f32(level))) / 3 + f32(pos));
}

fn travers(threadIndex: u32, iter: u32){
	let id: u32 = iter % 10u;
	let trav = traversal[id];

	var pTrav = traversal[id-1];
	let quad = quadFromeCoord(trav.coord, textureDimensions(texture)); 

	let node = getNode(u32(pTrav.address));
	var child = node.children[quad];

	if(child < 0.0 || ((pTrav.address == 0.0) && (id > 1u))) {
		levelValues[threadIndex][id] = 0.0;
		return;
	}
	levelValues[threadIndex][id] = values[u32(child)] / values[0];

	traversal[id].address = child;
}
fn getValue(node: Node) -> f32 {
	return values[u32(node.valueAddress)];
}

fn newCoordQuad(coord: vec2<f32>, tQuad: u32, textDim: vec2<u32>) -> vec2<f32> {		
	var pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));
	//return vec2<f32>(textDim);
	//return vec2<f32>(pixCoord);
	pixCoord.x = pixCoord.x * 2u / 2u;
	pixCoord.y = pixCoord.y * 2u / 2u;
	for (var x = 0u; x < 2u; x = x + 1u) {
		for (var y = 0u; y < 2u; y = y + 1u) {
			if (quadFromeCoord(vec2<f32>(f32(x), f32(y)), textDim) == tQuad) {
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
		
		let index: u32 = (iter) % 10u;
		var coord = traversal[index].coord;
		
		// Check if path is done
		var quad = quadFromeCoord(coord, texDim);
		let nodeIndex = getNodeIndex(index, quad);

		let trav = traversal[index];
		let node = getNode(u32(trav.address));
		let value = getValue(node) / values[0];
		
		// Write to texture
		let texCoord = vec2<u32>(vec2<f32>(texDim) * vec2<f32>(coord.x, coord.y));
		let color = vec4<f32>(value, 0.0, 0.0, 1.0);
		textureStore(texture, texCoord, color); 
	
		// Check if path is done
		if (checkQuadMapLevelDone(nodeIndex) || value == 0.0) {
			result[threadIndex][0u] = 666.0;
			quadMap[nodeIndex] = 1u;
			threadIterations.iterations[threadIndex] = 0u; 
			return;
		}
		
		
		// Next iteration Setup
		let children = node.children;
		let nextQuad = quadFromeCoord(coord, texDim*2u);
		var child = children[nextQuad];
		var childNodeIndex: u32 = getNodeIndex(index, nextQuad);
		if (child < 0.0 && quadMap[childNodeIndex] == 0u) {
			threadIterations.iterations[threadIndex] = 0u;
			quadMap[childNodeIndex] = 1u;
			return;
		}
		for (var i = 1u; i < 4u; i = i + 1u) {
			let q = (i + nextQuad) % 4u - 1u;
			child = children[q];
			childNodeIndex = getNodeIndex(index, q);
			if (child < 0.0) {
				quadMap[childNodeIndex] = 1u;
				continue;
			}
			if (quadMap[childNodeIndex] == 0u) {
				if (nextQuad != q) {
					coord = newCoordQuad(coord, q, texDim*2u);
				}
				break;
			}
		}
		threadIterations.iterations[threadIndex] = iter + 1u;
		traversal[index+1u].address = child;
		traversal[index+1u].coord = coord;
		traversal[0u].coord = coord;
		
		result[threadIndex][0u] = f32(texCoord.x);
		result[threadIndex][1u] = f32(texCoord.y);
		result[threadIndex][2u] = f32(texDim.x);
		result[threadIndex][3u] = f32(texDim.y);
		result[threadIndex][4u] = f32(coord.x);
		result[threadIndex][5u] = f32(coord.y);
		result[threadIndex][6u] = f32(nextQuad);
		/*
		result[threadIndex][index] = value;
		result[threadIndex][index] = f32(quad);
		*/



	  			
		/*
		// What is next node	
		if (checkQuadMapLevelDone(index)) {
			// TODO doesn't enter here
			quadMap[nodeIndex] = 1u;
			threadIterations.iterations[threadIndex] = iter + iter / 10u;
			return;
		}
		let nextQuad = quadFromeCoord(coord, texDim*2u);
		let children = node.children;
		let child = children[nextQuad];
		let childNodeIndex = getNodeIndex(index+1u, nextQuad);
	
		/*
		result[threadIndex][index] = f32(quadMap[nodeIndex]);
		result[threadIndex][index] = f32(child);
		result[threadIndex][index] = value;
		*/
		result[0u][0u] = coord.x;
		result[0u][1u] = coord.y;


		if (child < 0.0) {
			quadMap[childNodeIndex] = 1u;
			threadIterations.iterations[threadIndex] = iter + iter / 10u;
			let newQuad = (quad + 1u) % 4u;
			let coord = newCoordQuad(coord, newQuad, texDim*2u);

			traversal[index + index / 10u].coord = coord;
			result[0u][2u] = coord.x;
			result[0u][3u] = coord.y;
			result[0u][4u] = f32(texDim.x);
			result[0u][5u] = f32(texDim.y);
			return;
		}
		threadIterations.iterations[threadIndex] = iter + 1u;
		traversal[index+1u].address = child;
		traversal[index+1u].coord = coord;
		*/
	}
