
struct Node {
valueAddress: f32,
		      children: vec4<f32>,	
		      quad: f32
};

struct Traversal {
coord: vec2<f32>,
	       address: f32,
	       done: u32,
	       maxLevel: f32
};

struct ThreadInfo {
reference: array<f32, 16>,
		   dimensions: vec2<u32>,

};
@group(1) @binding(1) var<storage, read_write> threadIterations: ThreadInfo; 

fn getNode(index: u32) -> Node {
	let node: Node = Node(nodes[index * 6u],
			vec4<f32>(nodes[index * 6u + 1u], nodes[index * 6u + 2u], nodes[index * 6u + 3u], nodes[index * 6u + 4u]),
			nodes[index * 6u + 5u]
			);
	return node;
}

fn quadFromCoord(uv: vec2<f32>, textDim: vec2<u32>) -> u32 {
	if(textDim.x == 1u && textDim.y == 1u) {
		return 0u;
	}
	let pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	let quadCoord = pixCoord % 2u;
	let quad = quadCoord.x *2u + quadCoord.y;
	return u32(quad);
}
fn coordFromQuad(uv_s: vec2<f32>, textDim: vec2<u32>, quad: u32) -> vec2<f32> {
	let uv = uv_s;
	let quadCoord = vec2<u32>(quad % 2u, quad / 2 );
	var pixCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(uv.x, uv.y));
	pixCoord = pixCoord + quadCoord;

	let coord = vec2<f32>(pixCoord) / vec2<f32>(textDim*2u);
	return coord; 

}

fn getLevelIndex(level: u32) -> u32 {
	//return (4**level - 1) / 3;
	return u32(pow(4.0, f32(level)) - 1.0) / 3u;
}


fn getNodeIndex(level: u32, coord: vec2<u32>) -> u32 {
	let parentIndex = getLevelIndex(level);
	let grid_size = u32(pow(2.0, f32(level)));
	let y = coord[0];
	let x = coord[1];

	let index = coord[0] * grid_size + coord[1];
	return parentIndex+index;
}

fn getValue(node: Node) -> f32 {
	return values[u32(node.valueAddress)];
}

// check quadMap level of all is done
fn checkQuadMapLevelDone(index: u32, coord: vec2<u32>, node: Node) -> bool {
	let mipLevelLeft = i32(traversal[0u].maxLevel) - i32(index);
	if (mipLevelLeft <= 1){
		return true;
	}
	for (var i = 0u; i < 4u; i = i + 1u) {
		if(node.children[i] <= 0.0) {
			continue;
		}

		let quad = vec2<u32>(i / 2u, i % 2u);
		let pixCoord = 2u * vec2<u32>(coord) + quad;
		let nodeIndex = getNodeIndex(index+1, pixCoord);
		if quadMap[nodeIndex] == 0u {
			return false;
		}

	}
	return true;
}

fn writeTexture(coord: vec2<f32>, address: u32, quad: u32, index : u32, workgroup: vec3<u32>) {
	let node = getNode(address);
	var value = getValue(node);
	if (values[u32(address)] != 0){
		value /= values[0u];
	}

	let color = vec4<f32>(1.0 - value, f32(quad+1u)/4.0, 1.0 - f32(index)/10, 1.0);
	//let workgroupsize = f32(threadIterations.dimensions.x) -1.0;
	//let color = vec4<f32>(vec3<f32>(workgroup)/workgroupsize, 1.0);

	let textDim = textureDimensions(texture);
	let textCoord = vec2<u32>(vec2<f32>(textDim) * vec2<f32>(coord.x, coord.y));

	textureStore(texture, textCoord, color);
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

		let textDim = textureDimensions(texture)*2u;
		var threadDim = threadIterations.dimensions;
		if (threadDim.x == 0u ||threadDim.y == 0u) {
			// initialize thread info
			threadIterations.dimensions = textDim;
			threadDim = textDim;
		}
		let level = u32(log2(f32(textDim.x)) - 1.0);
		let minLevel = u32(log2(f32(threadDim.x)) - 1.0);

		let threadIndex: u32 = (global_id.x + global_id.y * threadDim.x)*16u + 1u;
		//let index: u32 = global_id.x + global_id.y*2u;
		let index: u32 = level + threadIndex; 

		var coord = traversal[index].coord;
		var pixCoord = vec2<u32>(vec2<f32>(textDim) * coord);
		

		let seedTrav = traversal[0u];
		if (textDim.x == threadDim.x) {
			let origPixCoord = vec2<u32>(vec2<f32>(threadDim) * seedTrav.coord);
			if (origPixCoord.x == pixCoord.x && origPixCoord.y == pixCoord.x) {
				coord = seedTrav.coord;
				traversal[index].coord = coord;
			}else{
				coord = vec2<f32>(global_id.xy) / vec2<f32>(textDim);
				traversal[index].coord = coord;
				pixCoord = global_id.xy;
			}
		}


		let nodeIndex = getNodeIndex(level, pixCoord);


		// check if outside traversal bounds (not needd for gpu)
		var addr = traversal[index].address;
		if (level == minLevel && addr == 0.0) {
			// for loop minLevel
			for (var i = 0u; i < minLevel; i = i + 1u) {
				let dim = u32(pow(2.0, f32(i)));
				let preQuad = quadFromCoord(coord, vec2<u32>(dim, dim)); 
				addr = getNode(u32(addr)).children[preQuad];
			}
			traversal[index].address = addr;
		}
		let node = getNode(u32(addr));
		let nextQuad = quadFromCoord(coord, textDim*2u);
		let children = node.children;

		var child = children[nextQuad];
		var childNodeIndex = 0u;
		var childPixCoord = vec2<u32>(0u, 0u);
		
		result[0u][0u] = f32(threadIndex);
		result[0u][1u] = f32(index);
		result[0u][2u] = f32(threadDim.x);
		result[0u][3u] = f32(textDim.x);
		result[0u][4u] = f32(addr);

		var childCoord = coord; 
		for (var j = 0u; j < 4u; j = j + 1u) {
			let q = (j + nextQuad) % 4u;
			child = children[q];
			let quadCoord = vec2<u32>(q / 2u, q % 2u);
			childPixCoord = 2u*pixCoord+quadCoord;


			childNodeIndex = getNodeIndex(level+1, childPixCoord);


			if (q != nextQuad){
				childCoord = vec2<f32>(f32(childPixCoord.x) / f32(textDim.x*2u), f32(childPixCoord.y) / f32(textDim.y*2u));
			}

			let childNode = getNode(u32(child));

			if ((quadMap[childNodeIndex] == 1u && checkQuadMapLevelDone(level+1, childPixCoord, childNode)) || (values[u32(child)] == 0.0)) {
				quadMap[childNodeIndex] = 1u;
				continue;
			}
			break;
		}

		let quad = quadFromCoord(coord, textDim);
		writeTexture(coord, u32(addr), quad, index, global_id);
		quadMap[childNodeIndex] = 1u;


		traversal[index+1].address = child;
		traversal[index+1].coord = childCoord;
		traversal[threadIndex].coord = childCoord;
		traversal[index+1u].done = 1u;
	}
