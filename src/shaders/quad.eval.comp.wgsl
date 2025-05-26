
struct Node {
valueAddress: f32,
		      children: vec4<f32>,	
		      quad: f32,
};

struct Traversal {
depth: f32,
	       coord: vec2<f32>,
	       address: f32,
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
fn coordFromQuad(uv: vec2<f32>, textDim: vec2<u32>, quad: u32) -> vec2<f32> {
/*
	result[0u][0u] = f32(quad);
	result[0u][1u] = uv.x;
	result[0u][2u] = uv.y;
	*/
	let quadCoord = vec2<u32>(quad / 2u, quad % 2u);
	let pixCoord = vec2<u32>(vec2<f32>(textDim*2u) * vec2<f32>(uv.x, uv.y)) + quadCoord;

	let coord = vec2<f32>(pixCoord) / vec2<f32>(textDim*2u);
	/*
	result[0u][3u] = coord.x;
	result[0u][4u] = coord.x;
	*/
	return coord; 

}


fn getNodeIndex(level: u32, pos: u32) -> u32 {

	return u32((pow(4, f32(level))) / 3 + f32(pos));
}

fn getValue(node: Node) -> f32 {
	return values[u32(node.valueAddress)];
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

		let index: u32 = u32(log(f32(texDim.x) / log(2.0)));
		var coord = traversal[index].coord;
	
	/*
		result[0u][0u] = f32(index);
		result[0u][1u] = f32(texDim.x);
		result[0u][2u] = f32(texDim.y);
		*/
		

		// Check if path is done
		var quad = quadFromeCoord(coord, texDim);
		let nodeIndex = getNodeIndex(index, quad);

		let trav = traversal[index];
		// check if trav is done
		let node = getNode(u32(trav.address));
		let value = getValue(node) / values[0];

		// Write to texture
		let texCoord = vec2<u32>(vec2<f32>(texDim) * vec2<f32>(coord.x, coord.y));
		let color = vec4<f32>(value, 0.0, 0.0, 1.0);
		textureStore(texture, texCoord, color);

		// Check if path is done
		if (checkQuadMapLevelDone(nodeIndex) || value == 0.0) {
			quadMap[nodeIndex] = 1u;
			/*
			result[0u][0u] = f32(nodeIndex);
			result[0u][1u] = value;
			result[0u][2u] = trav.address;
			result[0u][3u] = f32(quadMap[nodeIndex]);
			*/
			return;
		}

		// Next iteration Setup
		let children = node.children;
		let nextQuad = quadFromeCoord(coord, texDim*2u);
		var child = children[nextQuad];
		for (var i = 0u; i < 4u; i = i + 1u) {
			let q = (i + nextQuad) % 4u;
			child = children[q];
			let childNodeIndex: u32 = getNodeIndex(index, q);
			
			if (nextQuad != q) {
				//result[0u][7u] = f32(quadMap[childNodeIndex]);
				coord = coordFromQuad(coord, texDim, q);
				quadMap[childNodeIndex] = 1u;
				
				//result[threadIndex][index*2u] = coord.x;
				//result[threadIndex][index*2u+1u] = coord.y;
				result[threadIndex][index+1u] = f32(q);
				break;
			}
		}
		
		let childNode = getNode(u32(child));
		if (childNode.valueAddress <= 0.0) {
			quadMap[nodeIndex] = 1u;
			//result[0u][8u] = f32(quadMap[nodeIndex]);
			return;
		}


		traversal[index+1u].address = child;
		traversal[index+1u].coord = coord;
		

		threadIterations.reference[index+1u] = child;
		threadIterations.reference[index+1u] = getValue(getNode(u32(child))) / values[0];
		result[threadIndex][index+1u] = f32(nextQuad);
		//result[threadIndex][index] = f32(nodeIndex);
		//result[threadIndex][index+1u] = traversal[index+1u].address;
		

		traversal[0u].coord = coord;
	}
